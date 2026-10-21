import os, tempfile
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(tempfile.mkdtemp()) / "test.db")
os.environ["DEMO_MODE"] = "true"
os.environ["DEMO_INVITES"] = "false"
os.environ["APP_ENV"] = "development"
os.environ["APP_ORIGIN"] = "http://testserver"
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as client:
        yield client


@pytest.fixture()
def login(client):
    def sign(persona="maya"):
        r = client.post("/api/auth/demo/" + persona)
        assert r.status_code == 200, r.text
        client.headers["X-CSRF-Token"] = r.json()["csrf"]
        return r.json()["user"]

    return sign
