"""MacFlow's five reusable Muse conversations in an existing Chrome 22.

These tests never contact Muse, start a browser, or submit a prompt.
"""

from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from muse2api.accounts import Account
from muse2api.config import Settings
from muse2api.drivers.browser.chromium import ChromiumProcess
from muse2api.drivers.browser.driver import BrowserDriver, _Tab
from muse2api.errors import FeatureNotImplemented, UpstreamAuthError, UpstreamError

ROOT = Path("/Users/example/Library/Application Support/Google/Chrome")
PROFILE = "Profile 22"
ACCOUNT = Account(id="profile22", cookies={"hatch_sess": "test-only"})


def attach_driver(tmp_path: Path) -> BrowserDriver:
    driver = BrowserDriver(Settings(
        _env_file=None, data_dir=tmp_path,
        browser_attach_only=True,
        browser_expected_user_data_dir=ROOT,
        browser_expected_profile_directory=PROFILE,
        browser_expected_muse_target_id="selected-target-22",
        browser_conversation_slots=5,
        account_max_concurrency=5,
        warm_threads=2,  # Even if set, attach mode must NEVER send "Hi".
    ))
    # startup() sets this only when a Muse tab in the pinned profile is found.
    driver._pinned_browser_context_id = "pinned-context-22"
    return driver


def test_macflow_launcher_must_explicitly_enable_attach_mode(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path)
    assert settings.browser_attach_only is False  # upstream compatibility
    attached = attach_driver(tmp_path).settings
    assert attached.browser_attach_only is True
    assert attached.browser_expected_profile_directory == PROFILE
    assert attached.browser_expected_muse_target_id == "selected-target-22"


def test_never_launch_chrome_with_profile_22_as_user_data_root(tmp_path):
    real_root = Path.home() / "Library/Application Support/Google/Chrome"
    for unsafe_dir in (real_root, real_root / PROFILE, real_root / PROFILE / "Default"):
        chrome = ChromiumProcess(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            19210, unsafe_dir, attach_only=False,
        )
        with pytest.raises(RuntimeError, match="real Chrome profile tree"):
            chrome._refuse_wrong_profile_launch()
    chrome = ChromiumProcess(
        "", 19210, tmp_path,
        expected_user_data_dir=ROOT,
        expected_profile_directory="Profile 22",
    )
    with pytest.raises(RuntimeError, match="require browser_attach_only=true"):
        chrome._refuse_wrong_profile_launch()
    # A separate *test* Chromium sandbox is not a real browser profile.
    ChromiumProcess("", 19210, tmp_path)._refuse_wrong_profile_launch()


async def test_wrong_user_data_root_refuses_before_cdp_or_browser_launch(monkeypatch):
    chrome = ChromiumProcess(
        "", 19210, Path.home() / "Library/Application Support/Google/Chrome" / PROFILE,
        attach_only=False,
    )
    calls = []

    async def forbidden(*_args, **_kwargs):
        calls.append("would-contact-or-launch-browser")
        raise AssertionError("Must never probe CDP or launch Chrome")

    monkeypatch.setattr(chrome, "browser_ws_url", forbidden)
    monkeypatch.setattr(asyncio, "create_subprocess_exec", forbidden)
    with pytest.raises(RuntimeError, match="real Chrome profile tree"):
        await chrome.start()
    assert calls == []
    assert chrome.proc is None


def test_attach_guards_the_exact_existing_chrome_profile(monkeypatch):
    command = (
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome "
        "--remote-debugging-port=19210 "
        f"--user-data-dir={ROOT} --profile-directory={PROFILE} "
        "--no-first-run about:blank"
    )
    def fake_run(argv, **kwargs):
        if argv[0] == "lsof":
            return subprocess.CompletedProcess(argv, 0, stdout="87722\n", stderr="")
        return subprocess.CompletedProcess(argv, 0, stdout=command, stderr="")
    monkeypatch.setattr(subprocess, "run", fake_run)

    chrome = ChromiumProcess(
        "", 19210, ROOT, attach_only=True, expected_user_data_dir=ROOT,
        expected_profile_directory=PROFILE,
    )
    chrome._verify_existing_profile()
    chrome.expected_user_data_dir = ROOT / PROFILE
    with pytest.raises(RuntimeError, match="different Chrome process/profile|another Chrome process/profile"):
        chrome._verify_existing_profile()
    chrome.expected_user_data_dir = ROOT
    chrome.expected_profile_directory = ""
    with pytest.raises(RuntimeError, match="EXPECTED_PROFILE_DIRECTORY"):
        chrome._verify_existing_profile()
    chrome.expected_profile_directory = "Profile 21"
    with pytest.raises(RuntimeError, match="profile-directory"):
        chrome._verify_existing_profile()


async def test_attach_only_rejects_missing_cdp_without_launching_chrome(monkeypatch):
    chrome = ChromiumProcess("", 19210, ROOT, attach_only=True, expected_user_data_dir=ROOT)
    monkeypatch.setattr(chrome, "_verify_existing_profile", lambda: None)

    async def no_cdp():
        return None

    monkeypatch.setattr(chrome, "browser_ws_url", no_cdp)
    async def forbidden(*args, **kwargs):
        raise AssertionError("Must never call asyncio.create_subprocess_exec")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", forbidden)
    with pytest.raises(RuntimeError, match="no CDP endpoint"):
        await chrome.start()
    assert chrome.proc is None


async def test_default_profile_context_never_creates_incognito_or_mixes_accounts(tmp_path):
    driver = attach_driver(tmp_path)
    driver._browser = SimpleNamespace(send=lambda *args, **kwargs: pytest.fail(
        "Target.createBrowserContext is forbidden"
    ))
    assert await driver._context(ACCOUNT) == "pinned-context-22"
    assert await driver._context(ACCOUNT) == "pinned-context-22"
    with pytest.raises(UpstreamAuthError, match="one Muse account"):
        await driver._context(Account(id="someone-else", cookies={}))


async def test_five_blank_reusable_tabs_have_no_warm_prompt(tmp_path, monkeypatch):
    driver = attach_driver(tmp_path)
    driver._browser = SimpleNamespace(closed=False)
    calls: list[str] = []
    ids = iter(range(5))

    class FakeSession:
        closed = False

    async def fake_open(account):
        calls.append("open-tab")
        return _Tab(account.id, "pinned-context-22", f"slot-{next(ids)}", FakeSession())

    async def fake_new_thread(tab):
        calls.append("navigate-new-thread")

    async def forbidden_send(*args, **kwargs):
        raise AssertionError("Opening slots must not send a warm-up prompt")

    monkeypatch.setattr(driver, "_open_tab", fake_open)
    monkeypatch.setattr(driver, "_new_thread", fake_new_thread)
    monkeypatch.setattr(driver, "_send", forbidden_send)
    driver.prewarm(ACCOUNT)
    await asyncio.wait_for(driver._warming[ACCOUNT.id], 3)
    assert calls.count("open-tab") == 5
    assert calls.count("navigate-new-thread") == 5
    assert len(driver._tabs[ACCOUNT.id]) == 5
    assert all(not tab.warm and not tab.busy for tab in driver._tabs[ACCOUNT.id])
    picked = await driver._checkout(ACCOUNT)
    assert picked in driver._tabs[ACCOUNT.id]
    assert calls.count("open-tab") == 5  # No per-request new tab!
    await driver._checkin(picked)


async def test_tab_creation_uses_existing_window_and_does_not_write_cookies(
    tmp_path, monkeypatch
):
    driver = attach_driver(tmp_path)
    calls: list[tuple[str, dict]] = []
    async def fake_browser_send(method, params):
        calls.append((method, params))
        if method == "Target.createTarget":
            return {"targetId": "existing-profile-tab"}
        return {}
    driver._browser = SimpleNamespace(send=fake_browser_send)
    driver._chromium = SimpleNamespace(port=19210)

    class FakeSession:
        async def send(self, method, params=None):
            calls.append((method, params or {}))

    async def fake_connect(url):
        assert url == "ws://127.0.0.1:19210/devtools/page/existing-profile-tab"
        return FakeSession()
    monkeypatch.setattr(
        "muse2api.drivers.browser.driver.CDPSession.connect", fake_connect
    )
    tab = await driver._open_tab(ACCOUNT)
    assert tab.context_id == "pinned-context-22"
    assert ("Target.createTarget", {
        "url": "about:blank", "browserContextId": "pinned-context-22"
    }) in calls
    assert not any(
        method in ("Target.createBrowserContext", "Network.setCookie")
        for method, _ in calls
    )


async def test_startup_refuses_without_muse_anchor_before_creating_tabs(tmp_path, monkeypatch):
    driver = attach_driver(tmp_path)
    driver._pinned_browser_context_id = None
    events: list[str] = []

    async def fake_start(self):
        events.append("attach")
        return "ws://127.0.0.1:19210/devtools/browser/mock"

    class FakeBrowser:
        closed = False

        async def send(self, method, params=None):
            events.append(method)
            assert method == "Target.getTargets"
            return {"targetInfos": [
                {"type": "page", "url": "http://127.0.0.1:5182/#/workspace",
                 "browserContextId": "wrong-context"}
            ]}

        async def close(self):
            self.closed = True
            events.append("close")

    async def fake_connect(_):
        return FakeBrowser()

    monkeypatch.setattr("muse2api.drivers.browser.driver.ChromiumProcess.start", fake_start)
    monkeypatch.setattr("muse2api.drivers.browser.driver.CDPSession.connect", fake_connect)
    with pytest.raises(RuntimeError, match="selected Muse target"):
        await driver.startup()
    assert events == ["attach", "Target.getTargets", "close"]
    assert driver._browser is None


async def test_startup_pins_the_existing_muse_page_context(tmp_path, monkeypatch):
    driver = attach_driver(tmp_path)
    driver._pinned_browser_context_id = None

    async def fake_start(self):
        return "ws://127.0.0.1:19210/devtools/browser/mock"

    class FakeBrowser:
        closed = False

        async def send(self, method, params=None):
            assert method == "Target.getTargets"
            return {"targetInfos": [
                {"type": "page", "url": "https://muse.ai/thread/abc",
                 "targetId": "selected-target-22",
                 "browserContextId": "actual-muse-profile"},
                {"type": "page", "url": "https://other.example/",
                 "targetId": "other-target",
                 "browserContextId": "wrong-profile"},
            ]}

    async def fake_connect(_):
        return FakeBrowser()

    monkeypatch.setattr("muse2api.drivers.browser.driver.ChromiumProcess.start", fake_start)
    monkeypatch.setattr("muse2api.drivers.browser.driver.CDPSession.connect", fake_connect)
    await driver.startup()
    assert await driver._context(ACCOUNT) == "actual-muse-profile"
    health = await driver.health()
    assert health["ok"] is False
    assert health["tabs"] == 0


async def test_attach_mode_never_rotates_profile_cookies_or_runs_renewal(tmp_path, monkeypatch):
    driver = attach_driver(tmp_path)

    async def forbidden_renew(*args, **kwargs):
        raise AssertionError("Never rotate cookies in the user's active Chrome profile")

    monkeypatch.setattr("muse2api.drivers.browser.driver.muse.renew_session", forbidden_renew)
    with pytest.raises(FeatureNotImplemented, match="signed-in Chrome profile"):
        await driver.renew_session(ACCOUNT)


async def test_attach_mode_rejects_a_muse_page_in_an_unselected_profile(tmp_path, monkeypatch):
    driver = attach_driver(tmp_path)

    async def fake_start(self):
        return "ws://127.0.0.1:19210/devtools/browser/mock"

    class FakeBrowser:
        closed = False

        async def send(self, method, params=None):
            return {"targetInfos": [
                {"type": "page", "targetId": "other-profile-muse",
                 "url": "https://muse.ai/thread/abc",
                 "browserContextId": "other-profile"}
            ]}

        async def close(self):
            self.closed = True

    async def fake_connect(_):
        return FakeBrowser()

    monkeypatch.setattr("muse2api.drivers.browser.driver.ChromiumProcess.start", fake_start)
    monkeypatch.setattr("muse2api.drivers.browser.driver.CDPSession.connect", fake_connect)
    with pytest.raises(RuntimeError, match="selected Muse target"):
        await driver.startup()
    assert driver._browser is None


async def test_failed_tab_session_closes_only_its_own_created_target(tmp_path, monkeypatch):
    driver = attach_driver(tmp_path)
    methods: list[tuple[str, dict]] = []

    class FakeBrowser:
        closed = False

        async def send(self, method, params=None):
            methods.append((method, params or {}))
            if method == "Target.createTarget":
                return {"targetId": "new-slot-that-failed"}
            return {}

    async def failed_connect(_):
        raise RuntimeError("Tab websocket connection failed")

    driver._browser = FakeBrowser()
    driver._chromium = SimpleNamespace(port=19210)
    monkeypatch.setattr(
        "muse2api.drivers.browser.driver.CDPSession.connect", failed_connect
    )

    with pytest.raises(RuntimeError, match="websocket connection failed"):
        await driver._open_tab(ACCOUNT)
    assert ("Target.closeTarget", {"targetId": "new-slot-that-failed"}) in methods
    assert not any(params.get("targetId") == "selected-target-22" for _, params in methods)
    assert not any(method == "Target.createBrowserContext" for method, _ in methods)


async def test_attached_slot_pool_recovers_from_transient_failed_navigation(tmp_path, monkeypatch):
    driver = attach_driver(tmp_path)
    driver._browser = SimpleNamespace(closed=False)
    attempts = 0
    ids = iter(range(8))

    class FakeSession:
        closed = False

    async def fake_open(account):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("Transient navigation failure")
        return _Tab(account.id, "pinned-context-22", f"retry-slot-{next(ids)}", FakeSession())

    async def fake_new_thread(tab):
        pass

    async def no_sleep(_):
        pass

    monkeypatch.setattr(driver, "_open_tab", fake_open)
    monkeypatch.setattr(driver, "_new_thread", fake_new_thread)
    monkeypatch.setattr("muse2api.drivers.browser.driver.asyncio.sleep", no_sleep)
    await driver._fill_attached_conversations(ACCOUNT)
    assert attempts == 6  # one failed opening, then one replacement
    assert len(driver._tabs[ACCOUNT.id]) == 5


async def test_attached_request_never_opens_new_tab_with_incomplete_pool(tmp_path, monkeypatch):
    driver = attach_driver(tmp_path)
    driver._browser = SimpleNamespace(closed=False)
    tried_open = False

    async def forbidden_open(account):
        nonlocal tried_open
        tried_open = True
        raise AssertionError("A request must NEVER create a replacement Muse tab")

    monkeypatch.setattr(driver, "_open_tab", forbidden_open)
    monkeypatch.setattr(driver, "prewarm", lambda account: None)
    driver._tabs[ACCOUNT.id] = [
        _Tab(ACCOUNT.id, "pinned-context-22", f"slot-{i}",
             SimpleNamespace(closed=False))
        for i in range(4)
    ]
    with pytest.raises(UpstreamError, match="refusing to open a new tab"):
        await driver._checkout(ACCOUNT)
    assert not tried_open
