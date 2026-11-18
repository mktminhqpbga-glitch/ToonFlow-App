"""Runtime configuration, loaded from environment variables (prefix ``MUSE2API_``) and ``.env``."""

from __future__ import annotations

import os
import secrets
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DriverName = Literal["mock", "browser", "http", "chrome_extension"]
PoolStrategyName = Literal["round_robin", "lru", "affinity"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MUSE2API_",
        # The original Muse2API installation may keep its private .env outside
        # MacFlow; use that exact file only when explicitly supplied by its owner.
        env_file=os.environ.get("MUSE2API_CONFIG_FILE", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- server ---
    host: str = "127.0.0.1"
    port: int = 18610
    log_level: str = "INFO"
    public_base: str = Field(
        default="",
        description="Externally reachable base URL used when building media links. "
        "Empty means derive from the incoming request.",
    )

    # --- auth ---
    api_key: str = Field(default="", description="Bearer key for /v1/*. Auto-generated if empty.")
    admin_key: str = Field(default="", description="Bearer key for /admin/*. Falls back to api_key.")

    # --- storage ---
    data_dir: Path = Path("data")
    request_log_retention_days: float = Field(
        default=14, description="Days of /v1/* request history kept in data/requests.db."
    )
    media_retention_days: float = Field(
        default=14, description="Days generated media files are kept in data/media. "
        "0 disables automatic cleanup."
    )

    # --- upstream driver ---
    driver: DriverName = "mock"
    site_url: str = "https://muse.ai"

    # browser driver
    chromium_path: str = ""
    cdp_port: int = 19210
    headless: bool = True
    browser_proxy: str = Field(
        default="",
        description="Proxy for the browser only, e.g. socks5://127.0.0.1:10808 or http://10.144.1.10:8080. "
        "Python's own calls (session renewal) follow http_proxy/https_proxy instead.",
    )
    browser_profile_dir: Path | None = None
    # MacFlow: attach only to an already-running, explicitly pinned Chrome
    # instance. Never spawn Chrome, delete its profile locks, or switch profile.
    # Keep upstream default for compatibility with isolated Python callers.
    # The MacFlow launcher ALWAYS overrides this to true and checks it before
    # service start; never start a user-facing service without that launcher.
    browser_attach_only: bool = False
    browser_expected_user_data_dir: Path | None = None
    browser_expected_profile_directory: str = ""
    # One user-confirmed Muse target in the desired Chrome window. In a
    # multi-profile Chrome process, command-line flags alone are insufficient
    # to identify which browserContextId belongs to Profile 22.
    browser_expected_muse_target_id: str = ""
    # Idle /thread/new pages, not warm-up prompts (which consume Muse quota).
    browser_conversation_slots: int = Field(default=0, ge=0, le=5)
    # Safe alternative to CDP for Chrome 136+: the MacFlow extension runs inside
    # the *existing* Chrome profile and transports only a pinned tab's data.
    # This local endpoint is NOT Muse2API's own port; never route back to /v1.
    chrome_bridge_url: str = "http://127.0.0.1:3000/api/aiChrome/muse2api/bridge"
    chrome_bridge_token: str = ""
    chrome_profile22_confirmed: bool = False
    page_ready_timeout: float = 45.0
    warm_threads: int = Field(
        default=2,
        description="Pre-started muse.ai threads kept per account. A new thread takes muse.ai "
        "20-40s to answer its first message, a started one about 5s, so a chat that opens a new "
        "thread goes into a warm one instead. Each costs one extra short message of quota. "
        "Needs MUSE2API_ACCOUNT_MAX_CONCURRENCY of at least 2; 0 disables.",
    )
    warm_prompt: str = Field(default="Hi", description="Message that starts a warm thread.")

    # --- timeouts (seconds) ---
    chat_timeout: float = 300.0
    first_token_timeout: float = 75.0
    stream_heartbeat_interval: float = Field(
        default=0.0,
        description="SSE ': keepalive' comment interval while waiting for the first "
        "stream token; 0 disables. Keeps idle clients/proxies from timing out.",
    )
    image_timeout: float = 240.0
    video_timeout: float = 600.0

    # --- account pool ---
    pool_strategy: PoolStrategyName = "affinity"
    pool_acquire_timeout: float = 60.0
    account_max_concurrency: int = 4
    account_cooldown: float = 120.0
    max_failover: int = 2

    # --- background removal (images with background="transparent") ---
    matting_model: str = Field(
        default="birefnet-general",
        description="rembg model used to cut out the subject, e.g. birefnet-general "
        "(best) or birefnet-general-lite (faster).",
    )

    # --- keepalive (session renewal) ---
    keepalive_enabled: bool = True
    keepalive_interval: float = 600

    @field_validator("browser_profile_dir", "browser_expected_user_data_dir", mode="before")
    @classmethod
    def _blank_profile_dir_is_unset(cls, value: object) -> object:
        """``.env.example`` ships ``MUSE2API_BROWSER_PROFILE_DIR=``; ``Path("")`` would be the
        working directory, so Chrome would scatter its profile across the repo root."""
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @property
    def media_dir(self) -> Path:
        return self.data_dir / "media"

    @property
    def accounts_file(self) -> Path:
        return self.data_dir / "accounts.json"

    @property
    def tasks_file(self) -> Path:
        return self.data_dir / "tasks.json"

    @property
    def key_file(self) -> Path:
        return self.data_dir / "api_key"

    @property
    def keys_file(self) -> Path:
        return self.data_dir / "keys.json"

    @property
    def requests_db(self) -> Path:
        return self.data_dir / "requests.db"

    @property
    def profile_dir(self) -> Path:
        return self.browser_profile_dir or (self.data_dir / "browser-profile")

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.media_dir):
            d.mkdir(parents=True, exist_ok=True)

    def resolve_api_key(self) -> str:
        """Return the configured key, or load/generate a persistent one under ``data_dir``."""
        if self.api_key:
            return self.api_key
        self.ensure_dirs()
        if self.key_file.is_file():
            key = self.key_file.read_text(encoding="utf-8").strip()
            if key:
                self.api_key = key
                return key
        key = "m2a-" + secrets.token_urlsafe(24)
        self.key_file.write_text(key + "\n", encoding="utf-8")
        self.key_file.chmod(0o600)
        self.api_key = key
        return key

    @property
    def effective_admin_key(self) -> str:
        return self.admin_key or self.api_key


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
