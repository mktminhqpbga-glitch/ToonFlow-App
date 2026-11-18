"""Chromium process management."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import re
import shutil
import subprocess
from pathlib import Path

import httpx

log = logging.getLogger(__name__)

_CANDIDATES = (
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
)


def find_chromium(configured: str = "") -> str:
    for c in ((configured,) if configured else ()) + _CANDIDATES:
        if c and (os.path.isfile(c) or shutil.which(c)):
            return c
    raise FileNotFoundError(
        "Chromium/Chrome not found; install it or set MUSE2API_CHROMIUM_PATH"
    )


class ChromiumProcess:
    def __init__(self, executable: str, port: int, profile_dir: Path, headless: bool = True,
                 proxy: str = "", *, attach_only: bool = False,
                 expected_user_data_dir: Path | None = None,
                 expected_profile_directory: str = ""):
        self.executable = executable
        self.port = port
        self.profile_dir = profile_dir
        self.headless = headless
        self.proxy = proxy
        self.attach_only = attach_only
        self.expected_user_data_dir = expected_user_data_dir
        self.expected_profile_directory = expected_profile_directory
        self.proc: asyncio.subprocess.Process | None = None

    def _refuse_wrong_profile_launch(self) -> None:
        """Never turn a real Chrome profile into a new user-data ROOT.

        A directory named `Chrome/Profile 22` is a *profile inside* the
        Chrome user-data root, not the --user-data-dir itself. Chrome would
        create a new Default profile inside it; this was precisely the
        mistake made by the old Muse2API process. MacFlow must attach to an
        existing, positively identified Chrome process instead.
        """
        if self.attach_only:
            return
        if self.expected_user_data_dir is not None or self.expected_profile_directory:
            raise RuntimeError(
                "Pinned Chrome profile settings require browser_attach_only=true; "
                "refusing to open a second Chrome process."
            )
        path = self.profile_dir.expanduser().resolve()
        standard_roots = (
            Path.home() / "Library/Application Support/Google/Chrome",
            Path.home() / ".config/google-chrome",
            Path.home() / ".config/chromium",
        )
        if any(path == root.resolve() or root.resolve() in path.parents
               for root in standard_roots):
            raise RuntimeError(
                "Chrome user-data-dir points inside a real Chrome profile tree. "
                "Refusing to launch another Chrome with Profile 22 as user-data-dir; "
                "use attach-only with the existing Chrome profile instead."
            )

    def _verify_existing_profile(self) -> None:
        """Fail closed if the CDP listener belongs to a different Chrome profile.

        Chrome launched without --enable-automation does not implement
        Browser.getBrowserCommandLine; on this macOS host, inspect only the
        *listening process* with lsof/ps, never all browser windows.
        """
        if not self.expected_user_data_dir:
            raise RuntimeError(
                "Attach-only requires MUSE2API_BROWSER_EXPECTED_USER_DATA_DIR "
                "so tasks cannot go to the wrong Chrome profile."
            )
        if not self.expected_profile_directory:
            raise RuntimeError(
                "Attach-only requires MUSE2API_BROWSER_EXPECTED_PROFILE_DIRECTORY; "
                "a user-data-dir ending in Profile 22 is NOT proof of Chrome Profile 22."
            )
        try:
            listening = subprocess.run(
                ["lsof", "-nP", "-t", f"-iTCP:{self.port}", "-sTCP:LISTEN"],
                check=True, capture_output=True, text=True, timeout=4,
            )
            pids = [line.strip() for line in listening.stdout.splitlines()
                    if line.strip().isdigit()]
            if len(pids) != 1:
                raise RuntimeError("CDP port does not have exactly one owner")
            process = subprocess.run(
                ["ps", "-p", pids[0], "-o", "command="],
                check=True, capture_output=True, text=True, timeout=4,
            )
        except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            raise RuntimeError("Cannot verify the existing Chrome profile; refusing to attach") from exc

        command = process.stdout
        expected = str(self.expected_user_data_dir.expanduser())
        def has_arg(name: str, value: str) -> bool:
            return bool(re.search(
                r"(?:^|\s)" + re.escape(f"--{name}={value}") + r"(?=\s--|\sabout:|$)",
                command,
            ))

        if ("Google Chrome" not in command and "Chromium" not in command):
            raise RuntimeError("CDP port is not owned by the expected Chrome process")
        if not has_arg("remote-debugging-port", str(self.port)) or not has_arg("user-data-dir", expected):
            raise RuntimeError("CDP points to another Chrome process/profile; refusing to attach")
        if self.expected_profile_directory and not has_arg(
            "profile-directory", self.expected_profile_directory
        ):
            raise RuntimeError("Chrome is not using the required profile-directory")
        if re.search(r"(?:^|\s)--(?:incognito|guest)(?:\s|$)", command):
            raise RuntimeError("Private/guest Chrome is not the pinned persistent profile")

    @property
    def http_base(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    async def browser_ws_url(self) -> str | None:
        try:
            # Local DevTools port must not follow http_proxy/https_proxy.
            async with httpx.AsyncClient(timeout=2, trust_env=False) as client:
                r = await client.get(f"{self.http_base}/json/version")
                return r.json().get("webSocketDebuggerUrl")
        except (httpx.HTTPError, ValueError):
            return None

    async def start(self) -> str:
        """Start (or attach to an already running) Chromium; return the browser ws URL."""
        if self.attach_only:
            # Crucial: never fall back to launching Chrome if the original
            # profile/CDP process is missing or busy.
            self._verify_existing_profile()
            url = await self.browser_ws_url()
            if not url:
                raise RuntimeError("The selected Chrome profile has no CDP endpoint; no Chrome was launched")
            log.info("attached to the pinned existing Chrome process on CDP port %s", self.port)
            return url
        # Run this BEFORE probing another Chrome port or touching profile
        # lock files: even finding a CDP listener does not justify attaching
        # to a different profile in the unmanaged launch mode.
        self._refuse_wrong_profile_launch()
        if url := await self.browser_ws_url():
            log.info("attached to existing Chromium on port %s", self.port)
            return url

        self.profile_dir.mkdir(parents=True, exist_ok=True)
        for lock in ("SingletonLock", "SingletonSocket", "SingletonCookie"):
            with contextlib.suppress(FileNotFoundError):
                (self.profile_dir / lock).unlink()

        args = [
            self.executable,
            f"--remote-debugging-port={self.port}",
            "--remote-allow-origins=*",
            f"--user-data-dir={self.profile_dir}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-dev-shm-usage",
            "--disable-background-networking",
            "--autoplay-policy=no-user-gesture-required",
            "--window-size=1440,2200",
            "about:blank",
        ]
        if self.proxy:
            args.insert(1, f"--proxy-server={self.proxy}")
        if self.headless:
            args[1:1] = ["--headless=new", "--disable-gpu"]
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            args.insert(1, "--no-sandbox")

        log.info("launching Chromium: %s", self.executable)
        self.proc = await asyncio.create_subprocess_exec(
            *args, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
        )
        for _ in range(60):
            if url := await self.browser_ws_url():
                return url
            if self.proc.returncode is not None:
                break
            await asyncio.sleep(0.5)
        raise RuntimeError("Chromium did not expose a DevTools endpoint")

    async def stop(self) -> None:
        if self.proc and self.proc.returncode is None:
            self.proc.terminate()
            try:
                await asyncio.wait_for(self.proc.wait(), 10)
            except asyncio.TimeoutError:
                self.proc.kill()
        self.proc = None
