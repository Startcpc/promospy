"""Smoke-test the actual shareable archive via its public launcher on the runner OS."""
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent


def verify():
    with tempfile.TemporaryDirectory(prefix="PromoSpy ZIP ") as temp:
        archive = Path(temp) / "release.zip"
        subprocess.run(["node", "scripts/package-release.mjs", archive], cwd=ROOT, check=True)
        with ZipFile(archive) as release:
            assert release.testzip() is None
            release.extractall(temp)
        project = Path(temp) / "promospy"
        expected = json.loads((project / "package.json").read_text(encoding="utf-8"))["version"]
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        with (Path(temp) / "launcher.log").open("w+", encoding="utf-8") as log:
            server = subprocess.Popen(
                [sys.executable, "-u", "start.py", "--no-browser", "--port", str(port)],
                cwd=project, stdout=log, stderr=subprocess.STDOUT,
                start_new_session=os.name != "nt",
            )
            try:
                deadline = time.monotonic() + 720
                while time.monotonic() < deadline and server.poll() is None:
                    try:
                        with urlopen(f"http://127.0.0.1:{port}/api/health", timeout=3) as reply:
                            health = json.load(reply)
                    except OSError:
                        time.sleep(1)
                        continue
                    assert health["version"] == expected, health
                    with urlopen(f"http://127.0.0.1:{port}/api/catalog-status", timeout=5) as reply:
                        stores = json.load(reply)["stores"]
                    assert len(stores) == 11 and all(item["state"] == "unchecked" for item in stores.values())
                    print(f"ZIP {expected} launched on {sys.platform}. Verified {len(stores)} stores.")
                    return
                log.seek(0)
                raise RuntimeError(log.read()[-6000:])
            finally:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(server.pid)], check=False)
                elif server.poll() is None:
                    os.killpg(server.pid, signal.SIGTERM)
                server.wait(timeout=30)


if __name__ == "__main__":
    verify()
