#!/usr/bin/env bash
# Non-destructive MacFlow service entrypoint. Never stops or launches Chrome.
set -euo pipefail

MODE="${1:-check}"
case "$MODE" in diagnose|diagnose-extension|check|start) ;; *) echo "Usage: $0 [diagnose|diagnose-extension|check|start]" >&2; exit 2 ;; esac
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SOURCE="$PROJECT/services/muse2api"
PYTHON="$PROJECT/services/muse2api-v040/.venv/bin/python"

# Read-only diagnosis works even when the owner's custom Muse2API source
# has not yet been copied. Never inspect cookies or expose the user data.
if [[ "$MODE" == "diagnose" ]]; then
  python3 - <<'PY'
import json
import os
import re
import subprocess
from urllib.parse import urlsplit
from urllib.request import urlopen

port = os.environ.get("MUSE2API_CDP_PORT", "19210")
if not port.isdigit() or not 1 <= int(port) <= 65535:
    raise SystemExit("STOP: invalid CDP port")
try:
    owners = subprocess.run(
        ["lsof", "-nP", "-t", f"-iTCP:{port}", "-sTCP:LISTEN"],
        check=True, capture_output=True, text=True, timeout=3,
    ).stdout.splitlines()
except (OSError, subprocess.SubprocessError):
    owners = []
pids = [pid.strip() for pid in owners if pid.strip().isdigit()]
print(f"CDP {port}: {len(pids)} listener(s)")
if len(pids) != 1:
    raise SystemExit("STOP: exactly one verified Chrome CDP listener is required; nothing was changed")
try:
    command = subprocess.run(
        ["ps", "-p", pids[0], "-o", "command="],
        check=True, capture_output=True, text=True, timeout=3,
    ).stdout
except (OSError, subprocess.SubprocessError):
    raise SystemExit("STOP: could not verify Chrome listener owner")
root = os.path.expanduser("~/Library/Application Support/Google/Chrome")
def flag(value):
    return bool(re.search(r"(?:^|\s)" + re.escape(value) + r"(?=\s--|\sabout:|$)", command))

correct = ("Google Chrome" in command
           and flag(f"--remote-debugging-port={port}")
           and flag(f"--user-data-dir={root}")
           and flag("--profile-directory=Profile 22"))
wrong = flag(f"--user-data-dir={root}/Profile 22")
print(f"Owner PID: {pids[0]}")
print(f"Uses Profile 22 as WRONG user-data root: {wrong}")
print(f"Uses Chrome root + --profile-directory=Profile 22: {correct}")
try:
    with urlopen(f"http://127.0.0.1:{port}/json/list", timeout=3) as response:
        targets = json.load(response)
    muse_pages = [t for t in targets if t.get("type") == "page"
                  and urlsplit(str(t.get("url", ""))).hostname in ("muse.ai", "www.muse.ai")]
    print(f"Muse page targets: {len(muse_pages)}")
except Exception:
    muse_pages = []
    print("Muse page targets: unable to read")
if not correct or not muse_pages:
    raise SystemExit(
        "STOP: existing CDP does not prove the real Chrome Profile 22 / Muse tab; "
        "Muse2API must not attach or spawn another Chrome"
    )
print("PASS: flags and Muse page detected; confirm proxy and the exact target ID before start")
PY
  exit 0
fi

# Unlike CDP, an extension installed in the user's actual Profile 22 can
# operate that profile without --remote-debugging-port or new Chrome processes.
# This diagnostic is read-only and does not require copying the Python source.
if [[ "$MODE" == "diagnose-extension" ]]; then
  "$PYTHON" - <<'PY'
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
token = os.environ.get("MUSE2API_CHROME_BRIDGE_TOKEN", "")
if len(token) < 32:
    raise SystemExit("STOP: configure the private bridge token, not a Muse API key")
url = "http://127.0.0.1:3000/api/aiChrome/muse2api/bridge/verify"
req = Request(url, data=b"{}", method="POST", headers={
    "X-MacFlow-Muse-Bridge-Token": token, "Content-Type": "application/json",
})
try:
    with urlopen(req, timeout=4) as response:
        state = json.load(response)
except (HTTPError, URLError, ValueError) as exc:
    raise SystemExit(f"STOP: MacFlow extension bridge is not available ({type(exc).__name__})")
print(f"Chrome extension connected: {state.get('connected') is True}")
print(f"Managed Muse tabs: {state.get('tabs', 0)} of 5")
profile = state.get("profile") or {}
print(f"Profile manually selected: {profile.get('selectedProfile') or 'none'}")
print(f"Chrome proxy mode: {profile.get('proxyMode') or 'unknown'}")
print(f"Public IP country: {profile.get('countryCode') or 'unknown'}")
print(f"Proxy and US IP verified: {profile.get('verified') is True}")
print(f"All five Muse tabs ready: {state.get('ready') is True}")
print("This check cannot prove Chrome's profile name; confirm Profile 22 manually.")
if (not state.get("connected") or profile.get("selectedProfile") != "Profile 22"
    or not profile.get("verified") or profile.get("countryCode") != "US"
    or profile.get("proxyMode") not in ("fixed_servers", "pac_script")):
    raise SystemExit("STOP: existing Profile22 proxy and US egress not verified; no Chrome or Muse will be started")
PY
  exit 0
fi

if [[ ! -f "$SOURCE/src/muse2api/__main__.py" ]]; then
  echo "STOP: original running Muse2API source has not been copied to $SOURCE." >&2
  echo "The upstream clone is only a staging reference; it will not replace your service." >&2
  exit 3
fi
if [[ ! -x "$PYTHON" ]]; then
  echo "STOP: dedicated Python environment is missing." >&2
  exit 3
fi

# Preferred path for Chrome >=136: existing Chrome extension, not CDP.
# Explicit selection keeps the legacy CDP staging checks intact for diagnostics.
TRANSPORT="${MUSE2API_TRANSPORT:-extension}"
if [[ "$TRANSPORT" == "extension" ]]; then
  : "${MUSE2API_DATA_DIR:?Set the absolute path of the EXISTING Muse2API data folder}"
  : "${MUSE2API_CHROME_BRIDGE_TOKEN:?Set the private MacFlow/Python bridge token}"
  : "${MUSE2API_CHROME_PROFILE22_CONFIRMED:?Confirm extension is installed inside real Profile 22}"
  if [[ "$MUSE2API_DATA_DIR" != /* || ! -f "$MUSE2API_DATA_DIR/accounts.json" ]]; then
    echo "STOP: original absolute Muse2API data directory and accounts.json are required." >&2
    exit 3
  fi
  if [[ "$MUSE2API_CHROME_PROFILE22_CONFIRMED" != "true" ]]; then
    echo "STOP: verify the extension is inside real Profile 22 first, then set MUSE2API_CHROME_PROFILE22_CONFIRMED=true." >&2
    exit 3
  fi
  if [[ "${#MUSE2API_CHROME_BRIDGE_TOKEN}" -lt 32 ]]; then
    echo "STOP: bridge token must contain at least 32 characters." >&2
    exit 3
  fi
  export MUSE2API_DRIVER=chrome_extension
  export MUSE2API_BROWSER_ATTACH_ONLY=false
  export MUSE2API_WARM_THREADS=0
  export MUSE2API_KEEPALIVE_ENABLED=false
  export MUSE2API_ACCOUNT_MAX_CONCURRENCY=5
  export PYTHONPATH="$SOURCE/src"
  "$PYTHON" - <<'PY'
from pathlib import Path
import os
import muse2api
from muse2api.config import Settings
from muse2api.drivers.registry import create_driver
from muse2api.drivers.chrome_extension import ChromeExtensionDriver

if Path(os.environ["PYTHONPATH"]).resolve() not in Path(muse2api.__file__).resolve().parents:
    raise SystemExit("STOP: not importing the original Muse2API source copy")
settings = Settings()
if settings.driver != "chrome_extension" or not settings.chrome_profile22_confirmed:
    raise SystemExit("STOP: original customized Muse2API has not merged the extension driver/config")
if not isinstance(create_driver(settings), ChromeExtensionDriver):
    raise SystemExit("STOP: custom Muse2API cannot construct the extension bridge driver")
print("PASS: copied Muse2API supports extension driver; Chrome will not be launched")
PY
  "$PYTHON" - <<'PY'
import asyncio
import os
import httpx
from muse2api.config import Settings
async def main():
    settings = Settings()
    async with httpx.AsyncClient(
        headers={"X-MacFlow-Muse-Bridge-Token": settings.chrome_bridge_token},
        timeout=5, trust_env=False, follow_redirects=False,
    ) as client:
        response = await client.post(settings.chrome_bridge_url.rstrip("/") + "/verify", json={})
        response.raise_for_status()
        state = response.json()
        profile = state.get("profile") or {}
        if (not state.get("connected") or profile.get("selectedProfile") != "Profile 22"
                or profile.get("verified") is not True or profile.get("countryCode") != "US"
                or profile.get("proxyMode") not in ("fixed_servers", "pac_script")):
            raise SystemExit("STOP: existing Chrome Profile 22 proxy / US IP not confirmed")
        print(f"PASS: Profile22 network verified, owned Muse tabs {state.get('tabs', 0)}/5 (no AI request)")
asyncio.run(main())
PY
  if [[ "$MODE" == "check" ]]; then
    echo "PASS: extension preflight only; no browser or Muse2API process started."
    exit 0
  fi
  if [[ "${MACFLOW_PROFILE22_PROXY_CONFIRMED:-}" != "1" ]]; then
    echo "STOP: confirm proxy/account in Chrome Profile 22 before starting Muse2API." >&2
    exit 3
  fi
  if lsof -nP -t -iTCP:18610 -sTCP:LISTEN | grep -q .; then
    echo "STOP: port 18610 already in use. Preserve existing Muse2API/Chrome for safe handoff." >&2
    exit 3
  fi
  cd "$SOURCE"
  exec "$PYTHON" -m muse2api
fi
if [[ "$TRANSPORT" != "cdp" ]]; then
  echo "STOP: MUSE2API_TRANSPORT must be extension or cdp." >&2
  exit 3
fi
if [[ "$MODE" == "start" ]]; then
  echo "STOP: CDP cannot prove the selected Chrome profile's active US proxy; use MUSE2API_TRANSPORT=extension." >&2
  echo "No Chrome process or Muse task was started." >&2
  exit 3
fi

# Explicitly pin Chrome and preserve the old data/configuration. These values
# may be supplied by the user in their own environment, never hard-coded here.
: "${MUSE2API_DATA_DIR:?Set the absolute path of the EXISTING Muse2API data folder}"
: "${MUSE2API_BROWSER_EXPECTED_USER_DATA_DIR:?Set the Chrome user-data ROOT (not the profile subfolder)}"
: "${MUSE2API_BROWSER_EXPECTED_PROFILE_DIRECTORY:?Set the exact Chrome profile directory}"
: "${MUSE2API_BROWSER_EXPECTED_MUSE_TARGET_ID:?Set the ID of a Muse tab you verified in Profile 22}"
: "${MUSE2API_CDP_PORT:?Set the existing profile CDP port}"
if [[ "$MUSE2API_BROWSER_EXPECTED_PROFILE_DIRECTORY" != "Profile 22" ]]; then
  echo "STOP: MacFlow is authorized only for Chrome Profile 22." >&2
  exit 3
fi
if [[ "$MUSE2API_DATA_DIR" != /* ]]; then
  echo "STOP: MUSE2API_DATA_DIR must be the absolute OLD data directory." >&2
  exit 3
fi
if [[ ! -f "$MUSE2API_DATA_DIR/accounts.json" ]]; then
  echo "STOP: original Muse2API account data is missing; refusing a fresh installation." >&2
  exit 3
fi
export MUSE2API_DRIVER=browser
export MUSE2API_BROWSER_ATTACH_ONLY=true
export MUSE2API_BROWSER_CONVERSATION_SLOTS=5
export MUSE2API_ACCOUNT_MAX_CONCURRENCY=5
export MUSE2API_KEEPALIVE_ENABLED=false
export PYTHONPATH="$SOURCE/src"

# Read-only: verifies the ACTUAL listening Chrome process, not an arbitrary
# browser window. No cookie, API key, or proxy secret is printed.
"$PYTHON" - <<'PY'
from pathlib import Path
import json
import os
from urllib.parse import urlsplit
from urllib.request import urlopen
import muse2api
from muse2api.config import Settings
from muse2api.drivers.browser.chromium import ChromiumProcess

source = Path(muse2api.__file__).resolve()
expected = Path(os.environ["PYTHONPATH"]).resolve()
if expected not in source.parents:
    raise SystemExit("STOP: Python did not import the copied ORIGINAL Muse2API source")
settings = Settings()
if not getattr(settings, "browser_attach_only", False):
    raise SystemExit("STOP: original Muse2API code does not yet support attach-only")
if settings.browser_expected_profile_directory != "Profile 22":
    raise SystemExit("STOP: wrong Chrome profile configured")
if settings.account_max_concurrency != 5 or settings.browser_conversation_slots != 5:
    raise SystemExit("STOP: five-slot configuration is required")
ChromiumProcess(
    "", settings.cdp_port, settings.profile_dir,
    attach_only=True, expected_user_data_dir=settings.browser_expected_user_data_dir,
    expected_profile_directory=settings.browser_expected_profile_directory,
)._verify_existing_profile()
with urlopen(f"http://127.0.0.1:{settings.cdp_port}/json/list", timeout=3) as response:
    targets = json.load(response)
selected = [
    item for item in targets
    if item.get("id") == settings.browser_expected_muse_target_id
    and item.get("type") == "page"
    and urlsplit(str(item.get("url", ""))).hostname in ("muse.ai", "www.muse.ai")
]
if len(selected) != 1:
    raise SystemExit("STOP: selected Muse anchor tab is not visible in the required Chrome CDP")
print("PASS: source, Chrome process flags, and selected Muse target verified (proxy not auto-verified)")
PY

if [[ "$MODE" == "check" ]]; then
  echo "Read-only preflight complete; service and Chrome were left untouched."
  exit 0
fi

if [[ "${MACFLOW_PROFILE22_PROXY_CONFIRMED:-}" != "1" ]]; then
  echo "STOP: user must verify the Chrome Profile 22 proxy and explicitly set MACFLOW_PROFILE22_PROXY_CONFIRMED=1." >&2
  exit 3
fi
if lsof -nP -t -iTCP:18610 -sTCP:LISTEN | grep -q .; then
  echo "STOP: port 18610 is already in use. Do NOT kill Muse2API/Chrome without a safe handoff." >&2
  exit 3
fi
cd "$SOURCE"
exec "$PYTHON" -m muse2api
