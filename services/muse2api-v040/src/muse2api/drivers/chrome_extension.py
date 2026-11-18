"""Muse2API driver through an already-paired MacFlow Chrome extension.

No executable, Chrome profile, CDP port, cookie or proxy is manipulated here.
Request IDs are unique and are NEVER re-submitted after an uncertain result.
The HTTP endpoint must be a separate MacFlow backend, not Muse2API itself.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import uuid
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import urlsplit

import httpx

from ..accounts.model import Account
from ..config import Settings
from ..errors import UpstreamError
from .base import (
    ChatRequest,
    DriverCapabilities,
    ImageRequest,
    InputImage,
    MediaResult,
    MuseDriver,
    VideoRequest,
)


class ChromeBridgeUncertain(UpstreamError):
    """No retry, even when the HTTP response is lost after Chrome accepted a task."""

    code = "chrome_result_uncertain"
    retryable = False


class ChromeExtensionDriver(MuseDriver):
    name = "chrome_extension"
    # Login/cookies are owned by the already-open Chrome Profile 22.
    # A missing Python account record must not prevent the existing Chrome
    # login from being used; never import/overwrite accounts to compensate.
    requires_account = False
    capabilities = DriverCapabilities(
        chat=True, chat_images=True, image=True, image_edit=True, video=True,
        renew_session=False, quota=False,
    )

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._http: httpx.AsyncClient | None = None

    @property
    def _url(self) -> str:
        url = self.settings.chrome_bridge_url.rstrip("/")
        parts = urlsplit(url)
        if (parts.scheme != "http" or parts.hostname not in ("127.0.0.1", "localhost")
                or not parts.port or parts.username or parts.password
                or parts.query or parts.fragment
                or parts.path != "/api/aiChrome/muse2api/bridge"):
            raise RuntimeError("MacFlow Chrome bridge must use the exact localhost route")
        return url

    def _client(self) -> httpx.AsyncClient:
        if self._http is None:
            raise RuntimeError("Chrome extension driver chưa khởi động")
        return self._http

    @staticmethod
    def _profile_is_verified(state: dict[str, Any]) -> bool:
        profile = state.get("profile")
        return (
            state.get("ready") is True and state.get("tabs") == 5
            and isinstance(profile, dict)
            and profile.get("selectedProfile") == "Profile 22"
            and profile.get("confirmed") is True
            and profile.get("verified") is True
            and profile.get("proxyMode") in ("fixed_servers", "pac_script")
            and profile.get("countryCode") == "US"
        )

    async def startup(self) -> None:
        if not self.settings.chrome_profile22_confirmed:
            raise RuntimeError(
                "Cần xác minh extension MacFlow thực sự đang nằm trong Profile 22; "
                "đặt MUSE2API_CHROME_PROFILE22_CONFIRMED=true chỉ sau khi kiểm tra."
            )
        if len(self.settings.chrome_bridge_token) < 32:
            raise RuntimeError("Thiếu MUSE2API_CHROME_BRIDGE_TOKEN dài ít nhất 32 ký tự.")
        bridge_url = self._url  # Validate before making any connection.
        self._http = httpx.AsyncClient(
            headers={"X-MacFlow-Muse-Bridge-Token": self.settings.chrome_bridge_token},
            timeout=httpx.Timeout(30.0), trust_env=False,
            follow_redirects=False,
        )
        try:
            response = await self._client().post(
                f"{bridge_url}/ensure", json={"confirmExistingProfile22": True},
                timeout=60.0,
            )
            response.raise_for_status()
            # Opening tabs does not imply the Muse app's composer has loaded.
            for _ in range(60):
                state = await self._status()
                if self._profile_is_verified(state):
                    return
                await asyncio.sleep(1)
            raise RuntimeError(
                "Profile 22 chưa có đủ 5 tab Muse và bằng chứng proxy/IP Mỹ hợp lệ; "
                "chưa khởi động dịch vụ."
            )
        except BaseException:
            await self.shutdown()
            raise

    async def shutdown(self) -> None:
        if self._http is not None:
            client, self._http = self._http, None
            await client.aclose()
        # Do NOT close Chrome, user tabs, locks, profiles or extension.

    async def _status(self) -> dict[str, Any]:
        response = await self._client().get(f"{self._url}/status", timeout=5.0)
        response.raise_for_status()
        value = response.json()
        if not isinstance(value, dict):
            raise RuntimeError("Trạng thái MacFlow Chrome bridge không hợp lệ")
        return value

    async def health(self) -> dict[str, Any]:
        try:
            status = await self._status()
            tabs = status.get("tabs", 0)
            ready = self._profile_is_verified(status)
            return {"driver": self.name, "ok": ready, "tabs": tabs if isinstance(tabs, int) else 0,
                    "busy_tabs": status.get("busy_tabs", 0)}
        except (httpx.HTTPError, RuntimeError, ValueError):
            return {"driver": self.name, "ok": False, "tabs": 0, "busy_tabs": 0}

    @staticmethod
    def _images(images: list[InputImage]) -> list[dict[str, str]]:
        if len(images) > 8:
            raise ChromeBridgeUncertain("Tối đa 8 ảnh tham chiếu; chưa gửi yêu cầu.")
        files = []
        for i, image in enumerate(images):
            if image.mime not in ("image/png", "image/jpeg", "image/webp") or not image.data:
                raise ChromeBridgeUncertain("Ảnh tham chiếu trống hoặc không đúng PNG/JPEG/WebP.")
            files.append({"mimeType": image.mime, "label": f"Tham chiếu {i + 1}",
                          "dataBase64": base64.b64encode(image.data).decode("ascii")})
        return files

    async def _run(self, kind: str, prompt: str, specification: dict[str, Any],
                   images: list[InputImage], timeout: float) -> tuple[bytes, str]:
        task_id = str(uuid.uuid4())
        body = {"id": task_id, "kind": kind, "prompt": prompt, "specification": specification,
                "files": self._images(images)}
        try:
            response = await self._client().post(
                f"{self._url}/run", json=body,
                timeout=httpx.Timeout(max(1.0, timeout), connect=5.0),
            )
            response.raise_for_status()
            value = response.json()
            if value.get("id") != task_id or value.get("kind") != kind:
                raise ValueError("Sai mã tác vụ hoặc loại đầu ra MacFlow")
            encoded = value["dataBase64"]
            raw = base64.b64decode(encoded, validate=True)
            if (base64.b64encode(raw).decode("ascii") != encoded
                    or value.get("size") != len(raw)
                    or hashlib.sha256(raw).hexdigest() != value.get("sha256")):
                raise ValueError("Checksum media/ID không trùng; kết quả không đáng tin.")
            mime = value["mimeType"]
            if kind == "text":
                if mime != "text/plain":
                    raise ValueError("Không phải văn bản Muse")
                raw.decode("utf-8")
            elif mime not in {
                "image": ("image/png", "image/jpeg", "image/webp"),
                "video": ("video/mp4", "video/webm"),
            }[kind]:
                raise ValueError("Kiểu tệp Muse không khớp yêu cầu.")
            return raw, mime
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            # Never retry an uncertain POST. The exact UUID can be recovered
            # explicitly via /result/<uuid> if the server already saved bytes.
            raise ChromeBridgeUncertain(
                f"MacFlow Chrome task {task_id} chưa xác định/không thành công; "
                "không tự gửi lại prompt, kiểm tra receipt/result trước. "
                f"({type(exc).__name__})"
            ) from exc

    async def chat_stream(self, account: Account, req: ChatRequest) -> AsyncIterator[str]:
        # Prompt + user-supplied refs are delivered as one atomic package.
        # Avoid automatically re-sending previous turns to a reused tab.
        raw, _ = await self._run(
            "text", req.prompt, {"museModel": req.model, "conversationHint": req.conversation_hint},
            req.images, req.timeout,
        )
        yield raw.decode("utf-8")

    async def generate_image(self, account: Account, req: ImageRequest) -> list[MediaResult]:
        if req.n != 1:
            raise ChromeBridgeUncertain("Extension trả một ảnh mỗi tác vụ; không âm thầm tạo hoặc gửi lại nhiều lần.")
        data, mime = await self._run(
            "image", req.prompt, {"museModel": req.model, "size": req.size},
            req.reference_images, req.timeout,
        )
        if req.on_progress:
            req.on_progress(100)
        return [MediaResult(data=data, mime=mime, kind="image")]

    async def generate_video(self, account: Account, req: VideoRequest) -> MediaResult:
        data, mime = await self._run(
            "video", req.prompt, {"museModel": req.model, "size": req.size,
                                  "duration": req.duration},
            [req.first_frame] if req.first_frame else [], req.timeout,
        )
        if req.on_progress:
            req.on_progress(100)
        return MediaResult(data=data, mime=mime, kind="video")
