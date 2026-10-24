"""Check that a local API starts and no longer exposes demo sign-in."""

import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx

root = Path(__file__).resolve().parents[1]
with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
origin = f"http://127.0.0.1:{port}"
with tempfile.TemporaryDirectory() as tmp:
    env = {
        **os.environ,
        "APP_ENV": "development",
        "AI_API_KEY": "test-key",
        "AI_MODEL": "test-model",
        "DATABASE_URL": "sqlite:///" + str(Path(tmp) / "smoke.db"),
        "APP_ORIGIN": origin,
        "STATIC_DIR": str(root / "frontend/dist"),
    }
    processes = []
    try:
        api = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
                "--no-access-log",
            ],
            cwd=root / "backend",
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        processes.append(api)
        with httpx.Client(base_url=origin, timeout=5, trust_env=False) as client:
            for _ in range(100):
                try:
                    if client.get("/api/health").status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                time.sleep(0.1)
            else:
                raise AssertionError("API failed to start")
            index = client.get("/")
            assert index.status_code == 200 and "Soulplex" in index.text
            health = client.get("/api/health")
            assert health.status_code == 200 and health.json()["mode"] == "live"
            assert client.post("/api/auth/demo/maya").status_code == 404
            assert client.get("/api/openapi.json").status_code == 200
            print("PASS: API is live and demo sign-in is gone.")
    finally:
        for p in reversed(processes):
            p.terminate()
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait()
