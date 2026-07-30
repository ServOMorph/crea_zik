"""Launch the local Crea Zik studio.

Usage:
    uv run python run.py
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Launch the local Crea Zik UI.")
    parser.add_argument("--host", default="127.0.0.1", help="Local address to bind (default: 127.0.0.1).")
    parser.add_argument("--api-port", type=int, default=8003, help="API port (default: 8003).")
    parser.add_argument("--ui-port", type=int, default=5175, help="UI port (default: 5175).")
    parser.add_argument("--no-browser", action="store_true", help="Do not open the UI in the default browser.")
    return parser.parse_args()


def port_is_busy(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
        connection.settimeout(.2)
        return connection.connect_ex((host, port)) == 0


def wait_until_ready(url: str, process: subprocess.Popen[object], name: str) -> None:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"{name} stopped before becoming ready (exit code {process.returncode}).")
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(.2)
    raise RuntimeError(f"{name} did not become ready at {url}.")


def stop(process: subprocess.Popen[object] | None) -> None:
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def main() -> int:
    args = parse_args()
    if importlib.util.find_spec("uvicorn") is None or importlib.util.find_spec("crea_zik") is None:
        uv = shutil.which("uv")
        if uv is None:
            print("Python dependencies are missing. Install uv, then run: uv run python run.py", file=sys.stderr)
            return 2
        return subprocess.call([uv, "run", "python", str(ROOT / "run.py"), *sys.argv[1:]], cwd=ROOT)
    if args.host not in {"127.0.0.1", "localhost"}:
        print("For safety, --host must stay local (127.0.0.1 or localhost).", file=sys.stderr)
        return 2
    if port_is_busy(args.host, args.api_port) or port_is_busy(args.host, args.ui_port):
        print("The selected API or UI port is already in use. Choose different ports or stop the existing server.", file=sys.stderr)
        return 2

    node = shutil.which("node")
    vite = FRONTEND / "node_modules" / "vite" / "bin" / "vite.js"
    if node is None or not vite.is_file():
        print("Frontend dependencies are missing. Run: cd frontend && npm install", file=sys.stderr)
        return 2

    api_url = f"http://{args.host}:{args.api_port}"
    ui_url = f"http://{args.host}:{args.ui_port}"
    environment = os.environ | {"CREA_ZIK_API_URL": api_url}
    backend: subprocess.Popen[object] | None = None
    frontend: subprocess.Popen[object] | None = None
    try:
        backend = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "crea_zik.api:app", "--host", args.host, "--port", str(args.api_port)],
            cwd=ROOT,
        )
        wait_until_ready(f"{api_url}/api/health", backend, "API")
        frontend = subprocess.Popen([node, str(vite), "--host", args.host, "--port", str(args.ui_port)], cwd=FRONTEND, env=environment)
        wait_until_ready(ui_url, frontend, "UI")
        print(f"Crea Zik is running at {ui_url} (press Ctrl+C to stop).")
        if not args.no_browser:
            webbrowser.open(ui_url)
        while True:
            if backend.poll() is not None or frontend.poll() is not None:
                raise RuntimeError("A local server stopped unexpectedly.")
            time.sleep(.5)
    except KeyboardInterrupt:
        print("\nStopping Crea Zik...")
        return 0
    except RuntimeError as error:
        print(error, file=sys.stderr)
        return 1
    finally:
        stop(frontend)
        stop(backend)


if __name__ == "__main__":
    raise SystemExit(main())
