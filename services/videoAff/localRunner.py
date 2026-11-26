"""Run the VideoAFF database and web server under the local MacFlow process."""

import fcntl
import os
import signal
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from urllib.parse import urlencode


def stop(child: subprocess.Popen[bytes]) -> None:
    if child.poll() is not None:
        return
    child.terminate()
    try:
        child.wait(timeout=8)
    except subprocess.TimeoutExpired:
        child.kill()
        child.wait()


def run_checked(args: list[str | Path], stop_event: threading.Event, timeout: int) -> None:
    with subprocess.Popen(args, stdin=subprocess.DEVNULL) as child:
        try:
            deadline = time.monotonic() + timeout
            while not stop_event.wait(0.2):
                result = child.poll()
                if result is not None:
                    if result:
                        raise subprocess.CalledProcessError(result, args)
                    return
                if time.monotonic() >= deadline:
                    raise TimeoutError("VideoAFF setup command timed out")
            raise InterruptedError("MacFlow closed")
        finally:
            stop(child)


def main() -> None:
    source, root, pg_bin = map(Path, sys.argv[1:4])
    port = sys.argv[4]
    stop_event = threading.Event()

    def wait_for_macflow() -> None:
        sys.stdin.read()
        stop_event.set()

    threading.Thread(target=wait_for_macflow, daemon=True).start()
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, lambda *_: stop_event.set())

    # Use a private Unix socket and keep the database off the network.
    for key in tuple(os.environ):
        if key.startswith("PG"):
            os.environ.pop(key)
    with (root / "postgres.lock").open("a", encoding="utf-8") as lock:
        for _ in range(40):
            try:
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if stop_event.wait(0.25):
                    raise InterruptedError("MacFlow closed") from None
        else:
            raise RuntimeError("Another VideoAFF process is using this database")
        data = root / "postgres"
        if not (data / "PG_VERSION").is_file():
            if data.exists():
                raise RuntimeError("Existing VideoAFF database directory is incomplete")
            with tempfile.TemporaryDirectory(prefix="postgresInit", dir=root) as init:
                initial = Path(init) / "cluster"
                run_checked(
                    [pg_bin / "initdb", "-D", initial, "-U", "videoaff", "-A", "trust",
                     "--no-locale", "--encoding=UTF8"],
                    stop_event,
                    60,
                )
                initial.rename(data)

        with tempfile.TemporaryDirectory(prefix="macflowAff", dir="/tmp") as socket:
            pg_port = "5432"
            settings = [
                str(pg_bin / "postgres"), "-D", str(data), "-k", socket, "-p", pg_port,
                "-c", "listen_addresses=", "-c", "unix_socket_permissions=0700",
            ]
            with subprocess.Popen(settings, stdin=subprocess.DEVNULL) as database:
                try:
                    for _ in range(80):
                        if stop_event.wait(0.25) or database.poll() is not None:
                            raise RuntimeError("VideoAFF database stopped before it was ready")
                        check = subprocess.run(
                            [pg_bin / "pg_isready", "-q", "-h", socket, "-p", pg_port, "-U", "videoaff",
                             "-d", "postgres", "-t", "1"],
                            stdin=subprocess.DEVNULL, check=False, timeout=3,
                        )
                        if check.returncode == 0:
                            break
                    else:
                        raise TimeoutError("VideoAFF database is not ready")

                    query = urlencode({"host": socket, "port": pg_port})
                    os.environ["AIC_AI_DATABASE_URL"] = f"postgresql+psycopg://videoaff@/postgres?{query}"
                    os.environ["AIC_AI_DATA_ROOT"] = str(root / "media")
                    os.environ["AIC_AI_CONFIG_DIR"] = str(source / "config")
                    os.environ["AIC_AI_OBJECT_STORAGE_BACKEND"] = "filesystem"
                    os.chdir(source)
                    run_checked([sys.executable, "-m", "alembic", "upgrade", "head"], stop_event, 120)
                    command = [
                        sys.executable, "-m", "uvicorn", "ai_content.entrypoints.api.app:app",
                        "--host", "127.0.0.1", "--port", port,
                    ]
                    with subprocess.Popen(command, stdin=subprocess.DEVNULL) as api:
                        try:
                            while not stop_event.wait(0.5):
                                if api.poll() is not None or database.poll() is not None:
                                    raise RuntimeError("VideoAFF stopped")
                        finally:
                            stop(api)
                finally:
                    stop(database)


if __name__ == "__main__":
    main()
