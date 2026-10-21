"""Visitors can watch dates without signing in, but only where both members allow it."""
from fastapi.testclient import TestClient
from app.main import app
from tests.test_date_types import drain


def start_date(client, login, venue="cafe"):
    login("maya")
    cands = client.get("/api/candidates").json()["candidates"]
    r = client.post("/api/scenes", json={"partner_id": cands[0]["id"], "venue": venue}).json()
    return r["id"]


def visitor():
    return TestClient(app)


def test_visitors_see_live_dates_without_signing_in(client, login):
    sid = start_date(client, login, "walk")
    with visitor() as v:
        data = v.get("/api/public/island").json()
        (live,) = data["live"]
        assert live["id"] == sid and live["public"] is True and live["mine"] is False
        assert live["type"] == "walk" and live["spot"] in (0, 1)
        assert v.get("/api/island").status_code == 401  # the personal view still needs an account
        assert v.get("/api/public/dates/" + sid).json()["lines"] == []  # still in progress


def test_visitors_can_read_a_finished_date_when_both_allow_it(client, login):
    sid = start_date(client, login)
    drain()
    with visitor() as v:
        d = v.get("/api/public/dates/" + sid).json()
        assert d["status"] == "completed" and len(d["lines"]) == 8
        assert {l["side"] for l in d["lines"]} == {"a", "b"}
        flat = str(d)
        assert "fact_ids" not in flat and "speaker_id" not in flat and "@" not in flat and "assessment" not in flat


def test_turning_off_public_dates_makes_them_private(client, login):
    sid = start_date(client, login)
    drain()
    assert client.put("/api/settings", json={"public_dates": False}).json()["public_dates"] is False
    with visitor() as v:
        assert v.get("/api/public/dates/" + sid).status_code == 404
        live = v.get("/api/public/island").json()["live"]
        assert all(not x["public"] for x in live if x["id"] == sid)


def test_visitors_cannot_send_an_agent(client):
    with visitor() as v:
        assert v.post("/api/agent/explore", json={"count": 1}).status_code in (401, 403)
        assert v.post("/api/scenes", json={"partner_id": "x"}).status_code in (401, 403)


def test_new_members_keep_dates_private_by_default(client):
    r = client.post("/api/auth/register", json={"email": "new@example.com", "password": "a-long-password-1", "name": "Nia", "age": 30, "city": "Dubai", "gender": "woman", "seeking": ["man"], "consent": True})
    if r.status_code == 200:
        assert r.json()["user"]["public_dates"] is False
