"""Offline verification of the no-CDP Muse2API -> MacFlow extension transport."""

from __future__ import annotations

import base64
import hashlib
import json

import httpx
import pytest

from muse2api.accounts import Account
from muse2api.config import Settings
from muse2api.drivers.base import ChatRequest, ImageRequest, InputImage, VideoRequest
from muse2api.drivers.chrome_extension import ChromeBridgeUncertain, ChromeExtensionDriver
from muse2api.drivers.registry import create_driver

PNG = bytes([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
PNG2 = PNG + b"second"
ACCOUNT = Account(id="test-muse", label="No browser launched")


def driver(tmp_path) -> ChromeExtensionDriver:
    settings = Settings(
        _env_file=None,
        driver="chrome_extension",
        data_dir=tmp_path / "data",
        chrome_bridge_token="test-token-" * 4,
        chrome_profile22_confirmed=True,
    )
    created = create_driver(settings)
    assert isinstance(created, ChromeExtensionDriver)
    assert created.requires_account is False
    return created


def reply(task: dict, payload: bytes, mime: str) -> dict:
    return {
        "id": task["id"], "kind": task["kind"], "mimeType": mime,
        "dataBase64": base64.b64encode(payload).decode("ascii"),
        "size": len(payload), "sha256": hashlib.sha256(payload).hexdigest(),
    }


def attach_mock(driver: ChromeExtensionDriver, responder) -> None:
    driver._http = httpx.AsyncClient(
        transport=httpx.MockTransport(responder),
        headers={"X-MacFlow-Muse-Bridge-Token": driver.settings.chrome_bridge_token},
    )


async def test_extension_startup_refuses_unconfirmed_profile_and_weak_secret(tmp_path):
    d = driver(tmp_path)
    d.settings.chrome_profile22_confirmed = False
    with pytest.raises(RuntimeError, match="Profile 22"):
        await d.startup()
    assert d._http is None
    d.settings.chrome_profile22_confirmed = True
    d.settings.chrome_bridge_token = "weak"
    with pytest.raises(RuntimeError, match="TOKEN"):
        await d.startup()
    assert d._http is None
    d.settings.chrome_bridge_token = "secret" * 6
    d.settings.chrome_bridge_url = "http://127.0.0.1:18610/v1/images/generations"
    with pytest.raises(RuntimeError, match="exact localhost route"):
        await d.startup()
    assert d._http is None


async def test_extension_startup_ensures_five_tabs_without_browser_process(tmp_path):
    d = driver(tmp_path)
    calls: list[str] = []

    def responder(req: httpx.Request):
        calls.append(req.url.path)
        assert req.url.host == "127.0.0.1"
        assert req.headers["X-MacFlow-Muse-Bridge-Token"] == d.settings.chrome_bridge_token
        if req.url.path.endswith("/ensure"):
            assert json.loads(req.content) == {"confirmExistingProfile22": True}
            return httpx.Response(200, json={"ready": False, "tabs": 0})
        return httpx.Response(200, json={
            "connected": True, "ready": True, "tabs": 5,
            "profile": {"selectedProfile": "Profile 22", "confirmed": True,
                        "verified": True, "proxyMode": "fixed_servers", "countryCode": "US"},
        })

    # Patch the HTTP client constructor with an offline MockTransport;
    # no Chrome process, socket or external network is ever started.
    original = httpx.AsyncClient

    def factory(**kwargs):
        kwargs["transport"] = httpx.MockTransport(responder)
        return original(**kwargs)

    from muse2api.drivers import chrome_extension

    previous = chrome_extension.httpx.AsyncClient
    chrome_extension.httpx.AsyncClient = factory
    try:
        await d.startup()
        assert calls == [
            "/api/aiChrome/muse2api/bridge/ensure",
            "/api/aiChrome/muse2api/bridge/status",
        ]
        assert (await d.health())["tabs"] == 5
    finally:
        chrome_extension.httpx.AsyncClient = previous
        await d.shutdown()


async def test_image_reference_order_checksum_and_no_duplicate_submission(tmp_path):
    d = driver(tmp_path)
    ids = []
    prompts = []

    def responder(req: httpx.Request):
        task = json.loads(req.content)
        ids.append(task["id"])
        prompts.append(task)
        return httpx.Response(200, json=reply(task, PNG, "image/png"))

    attach_mock(d, responder)
    try:
        result = await d.generate_image(ACCOUNT, ImageRequest(
            prompt="Giữ trang phục", model="muse-image", size="16:9", n=1,
            reference_images=[InputImage(PNG), InputImage(PNG2)],
        ))
        assert len(ids) == 1
        assert len(set(ids)) == 1
        assert [base64.b64decode(item["dataBase64"]) for item in prompts[0]["files"]] == [PNG, PNG2]
        assert prompts[0]["specification"] == {"museModel": "muse-image", "size": "16:9"}
        assert result[0].data == PNG
        assert result[0].mime == "image/png"
        with pytest.raises(ChromeBridgeUncertain, match="một ảnh mỗi tác vụ"):
            await d.generate_image(ACCOUNT, ImageRequest(prompt="x", model="muse-image", n=2))
        assert len(ids) == 1
    finally:
        await d.shutdown()


async def test_text_and_video_use_same_extension_not_cdp(tmp_path):
    d = driver(tmp_path)
    tasks = []

    def responder(req):
        task = json.loads(req.content)
        tasks.append(task)
        mime = "text/plain" if task["kind"] == "text" else "video/mp4"
        data = b"hello text" if task["kind"] == "text" else b"\x00\x00\x00\x18ftypmp42"
        return httpx.Response(200, json=reply(task, data, mime))

    attach_mock(d, responder)
    try:
        chunks = [item async for item in d.chat_stream(
            ACCOUNT, ChatRequest(prompt="Chào", model="text", images=[InputImage(PNG)]))]
        assert chunks == ["hello text"]
        video = await d.generate_video(
            ACCOUNT, VideoRequest(prompt="Chuyển động", model="video", first_frame=InputImage(PNG)))
        assert video.kind == "video"
        assert [task["kind"] for task in tasks] == ["text", "video"]
        assert len(tasks[0]["files"]) == len(tasks[1]["files"]) == 1
    finally:
        await d.shutdown()


async def test_uncertain_result_never_automatically_resends(tmp_path):
    d = driver(tmp_path)
    attempts = []

    def responder(req):
        attempts.append(json.loads(req.content)["id"])
        return httpx.Response(503, json={"error": "unknown after submit"})

    attach_mock(d, responder)
    try:
        with pytest.raises(ChromeBridgeUncertain, match="không tự gửi lại prompt"):
            await d.generate_image(ACCOUNT, ImageRequest(prompt="Không thử lại", model="muse-image"))
        assert len(attempts) == 1
    finally:
        await d.shutdown()


def test_python_refuses_disconnected_or_non_us_profile_even_with_five_tabs(tmp_path):
    d = driver(tmp_path)
    valid = {"ready": True, "tabs": 5,
             "profile": {"selectedProfile": "Profile 22", "confirmed": True,
                         "verified": True, "proxyMode": "fixed_servers",
                         "countryCode": "US"}}
    assert d._profile_is_verified(valid)
    for altered in (
        {**valid, "tabs": 4},
        {**valid, "profile": {**valid["profile"], "selectedProfile": "Profile 21"}},
        {**valid, "profile": {**valid["profile"], "proxyMode": "direct"}},
        {**valid, "profile": {**valid["profile"], "proxyMode": "system"}},
        {**valid, "profile": {**valid["profile"], "countryCode": "VN"}},
        {**valid, "profile": {**valid["profile"], "verified": False}},
        {**valid, "profile": {**valid["profile"], "confirmed": False}},
        {**valid, "profile": None},
    ):
        assert not d._profile_is_verified(altered)


async def test_refuse_wrong_checksum_or_mime(tmp_path):
    d = driver(tmp_path)

    def responder(req):
        task = json.loads(req.content)
        value = reply(task, PNG, "video/mp4")
        value["sha256"] = "0" * 64
        return httpx.Response(200, json=value)

    attach_mock(d, responder)
    try:
        with pytest.raises(ChromeBridgeUncertain, match="không tự gửi lại"):
            await d.generate_image(ACCOUNT, ImageRequest(prompt="Kiểm thử", model="muse-image"))
    finally:
        await d.shutdown()
