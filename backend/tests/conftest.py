import os, tempfile
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(tempfile.mkdtemp()) / "test.db")
os.environ["APP_ENV"] = "development"
os.environ["APP_ORIGIN"] = "http://testserver"
os.environ["AI_API_KEY"] = "test-key"
os.environ["AI_MODEL"] = "test-model"
os.environ["SOULPLEX_FIXTURE_PASSWORD"] = "fixture-password-ok"
os.environ.pop("DEMO_MODE", None)
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine
from app.seed import seed


@pytest.fixture(autouse=True)
def provider_stubs(monkeypatch):
    import app.main as main
    import app.worker as worker
    from provider_stub import assess, interview, moderate, run_dialogue

    monkeypatch.setattr(main, "mail_ready", lambda: True)
    monkeypatch.setattr(main, "send_auth_email", lambda *args, **kwargs: None)
    monkeypatch.setattr(main, "interview", interview)
    monkeypatch.setattr(main, "moderate", moderate)
    monkeypatch.setattr(worker, "run_dialogue", run_dialogue)
    monkeypatch.setattr(worker, "assess", assess)


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as client:
        seed()
        yield client


@pytest.fixture()
def login(client):
    def sign(persona="maya"):
        r = client.post(
            "/api/auth/login",
            json={
                "email": persona + "@demo.soulplex.local",
                "password": "fixture-password-ok",
            },
        )
        assert r.status_code == 200, r.text
        client.headers["X-CSRF-Token"] = r.json()["csrf"]
        return r.json()["user"]

    return sign
