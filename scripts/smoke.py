"""Run an isolated real HTTP/API/worker smoke with fictional data. No API keys."""

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
        "DEMO_MODE": "true",
        "APP_ENV": "development",
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
            r = client.post("/api/auth/demo/maya")
            r.raise_for_status()
            client.headers["X-CSRF-Token"] = r.json()["csrf"]
            partner = client.get("/api/candidates").json()["candidates"][0]
            r = client.post(
                "/api/scenes", json={"partner_id": partner["id"], "venue": "garden"}
            )
            r.raise_for_status()
            sid = r.json()["id"]
            assert client.get("/api/scenes/" + sid).json()["status"] == "queued"
            worker = subprocess.Popen(
                [sys.executable, "-m", "app.worker"],
                cwd=root / "backend",
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            processes.append(worker)
            for _ in range(100):
                result = client.get("/api/scenes/" + sid).json()
                if result["status"] == "completed":
                    break
                assert result["status"] != "failed", result
                time.sleep(0.1)
            else:
                raise AssertionError("Worker did not complete the scene")
            assert len(result["output"]["dialogue"]) == 6 and result["contact"] is None
            assert client.get("/api/openapi.json").status_code == 200
            print(
                "PASS: compiled frontend served; HTTP auth and candidates; durable queued scene completed by separate worker; six turns; contact stays hidden."
            )
    finally:
        for p in reversed(processes):
            p.terminate()
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait()
