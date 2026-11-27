"""FastAPI application for the affiliate content dashboard."""

from __future__ import annotations

import json
import os
import re
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from ai_content.platform.observability import (
    READINESS,
    HttpObservabilityMiddleware,
    configure_observability,
    instrument_fastapi,
    metrics_asgi_app,
)
from ai_content.settings import ApplicationSettings

from .ai_usage import router as ai_usage_router
from .creative_knowledge import router as creative_knowledge_router
from .dependencies import check_runtime_readiness, get_runtime_settings, lifespan
from .notifications import router as notifications_router
from .products import router as products_router

_APPLICATION_SETTINGS = ApplicationSettings()
_OBSERVABILITY_SETTINGS = _APPLICATION_SETTINGS.observability("aicontent-api")
_OBSERVABILITY_RUNTIME = configure_observability(_OBSERVABILITY_SETTINGS)


class HealthResponse(BaseModel):
    """Simple service health check payload."""

    status: str = "ok"
    service: str = "affiliate-content-api"
    checks: dict[str, str] = Field(default_factory=dict)


app = FastAPI(
    title="Affiliate Content API",
    version="0.1.0",
    description="Collects TikTok Shop products and Pinterest references for affiliate content.",
    lifespan=lifespan,
)
app.state.observability_settings = _OBSERVABILITY_SETTINGS
app.state.observability_runtime = _OBSERVABILITY_RUNTIME
app.add_middleware(
    HttpObservabilityMiddleware,
    service_name=_OBSERVABILITY_SETTINGS.service_name,
)
app.mount("/internal/metrics", metrics_asgi_app(), name="internal-metrics")
app.include_router(ai_usage_router)
app.include_router(creative_knowledge_router)
app.include_router(notifications_router)
app.include_router(products_router)


def _configure_cors(application: FastAPI) -> None:
    """Allow local browser origin access during dashboard development."""
    allow_origins = [
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ]
    allow_pattern = _APPLICATION_SETTINGS.cors_allow_origin
    if allow_pattern:
        allow_origins.append(allow_pattern)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
    )


@app.get("/api/v1/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.get("/api/v1/macflow-host")
async def macflow_host() -> dict[str, str | None]:
    """Share the loopback MacFlow origin with the VideoAFF Chrome extension."""
    raw = os.environ.get("AIC_MACFLOW_ORIGIN", "")
    try:
        url = urlsplit(raw)
        if (
            url.scheme in {"http", "https"}
            and url.hostname in {"127.0.0.1", "localhost", "::1"}
            and url.port != 0
            and url.username is None
            and url.password is None
            and url.path in {"", "/"}
            and not url.query
            and not url.fragment
        ):
            return {"origin": f"{url.scheme}://{url.netloc}"}
    except ValueError:
        pass
    return {"origin": None}


@app.get("/api/v1/extension/download")
def download_extension(request: Request) -> Response:
    """Package the Chrome extension shipped with this installation."""
    root = Path(os.environ.get("AIC_EXTENSION_DIR") or Path(__file__).resolve().parents[4] / "extension")
    files = (
        "manifest.json", "background.js", "content.js", "hook.js", "popup.html",
        "popup.css", "popup.js", "icon.png", "README.md",
    )
    collector_origin = request.headers.get("x-video-aff-collector-origin")
    collector_token = request.headers.get("x-video-aff-collector-token")
    extension_config = None
    if collector_origin or collector_token:
        try:
            url = urlsplit(collector_origin or "")
            if (
                url.scheme not in {"http", "https"} or not url.hostname or url.port == 0
                or url.username is not None or url.password is not None or url.path
                or url.query or url.fragment or not re.fullmatch(r"[a-f0-9]{64}", collector_token or "")
            ):
                raise ValueError("Invalid collector connection")
        except ValueError as error:
            raise HTTPException(status_code=400, detail="Địa chỉ kết nối MacFlow không hợp lệ.") from error
        host = f"[{url.hostname}]" if ":" in url.hostname else url.hostname
        extension_config = {
            "origin": collector_origin,
            "products": f"{collector_origin}/api/videoAff/studio/api/v1/products",
            "token": collector_token,
        }
    output = BytesIO()
    try:
        with ZipFile(output, "w", ZIP_DEFLATED) as archive:
            for name in files:
                target = f"VideoAFF-Collector/{name}"
                if extension_config and name == "manifest.json":
                    manifest = json.loads((root / name).read_text(encoding="utf-8"))
                    manifest["host_permissions"] = [item for item in manifest["host_permissions"] if item.startswith("https://")]
                    manifest["host_permissions"].append(f"{url.scheme}://{host}/*")
                    archive.writestr(target, json.dumps(manifest, ensure_ascii=False, indent=2))
                elif extension_config and name in {"popup.js", "background.js"}:
                    prefix = "globalThis.videoAffConnection = " + json.dumps(extension_config) + ";\n"
                    archive.writestr(target, prefix + (root / name).read_text(encoding="utf-8"))
                else:
                    archive.write(root / name, target)
            archive.write(root.parent / "LICENSE", "VideoAFF-Collector/LICENSE")
    except OSError as error:
        raise HTTPException(
            status_code=503, detail="Chưa có tệp tiện ích Chrome trong bản VideoAFF này."
        ) from error
    return Response(
        output.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="VideoAFF-Collector.zip"',
            "Cache-Control": "no-store",
        },
    )


@app.get("/health/live", response_model=HealthResponse)
async def live() -> HealthResponse:
    """Report process liveness without touching external dependencies."""
    return HealthResponse(checks={"process": "ok"})


@app.get(
    "/health/ready",
    response_model=HealthResponse,
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HealthResponse}},
)
async def ready(request: Request) -> HealthResponse | JSONResponse:
    """Report whether the data directory and the selected database are usable."""
    container = getattr(request.app.state, "postgres_runtime", None)
    database = container.database if container is not None else None
    readiness = await check_runtime_readiness(get_runtime_settings(), database)
    for dependency, value in readiness.checks.items():
        READINESS.labels(
            service=_OBSERVABILITY_SETTINGS.service_name,
            dependency=dependency,
        ).set(value == "ok")
    response = HealthResponse(
        status="ok" if readiness.ready else "not_ready",
        checks=readiness.checks,
    )
    if readiness.ready:
        return response
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content=response.model_dump(),
    )


class DashboardStaticFiles(StaticFiles):
    """Serve the React entrypoint for client-side dashboard routes."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != status.HTTP_404_NOT_FOUND:
                raise
            return await super().get_response("index.html", scope)


def _mount_frontend(application: FastAPI) -> None:
    """Serve the production dashboard build when it exists."""
    dashboard_dir = os.environ.get("AIC_DASHBOARD_DIR")
    frontend_dir = Path(dashboard_dir) if dashboard_dir else Path(__file__).resolve().parents[4] / "frontend" / "dist"
    if frontend_dir.is_dir():
        application.mount(
            "/dashboard",
            DashboardStaticFiles(directory=str(frontend_dir), html=True),
            name="dashboard",
        )
    else:
        logger.debug("No dashboard frontend found at {}", frontend_dir)


_configure_cors(app)
_mount_frontend(app)
instrument_fastapi(app, _OBSERVABILITY_SETTINGS)


def create_app() -> FastAPI:
    """Factory for external callers (tests / app factories)."""
    return app


app.add_exception_handler(
    ValueError,
    lambda _request, exc: JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    ),
)
