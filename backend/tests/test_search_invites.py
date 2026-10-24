import asyncio
from sqlalchemy import select
from app.db import SessionLocal, User
from app.worker import process_one


def drain():
    while asyncio.run(process_one()):
        pass


def set_user(name, **kw):
    with SessionLocal() as db:
        u = db.scalar(select(User).where(User.name == name))
        for k, v in kw.items():
            setattr(u, k, v)
        db.commit()


def test_search_shows_outside_my_filters_but_never_against_theirs(client, login):
    login("maya")
    set_user("Maya", age_min=30, age_max=32)  # Maya narrows her own range
    r = client.get("/api/search").json()
    names = {c["name"] for c in r["matches"]}
    outside = {c["name"]: c["outside"] for c in r["outside"]}
    assert "Arjun" in names  # 31 fits
    assert "Karan" in outside and "33" in outside["Karan"][0]
    # Someone whose own range excludes Maya is never shown, only counted.
    set_user("Omar", age_min=31)
    r = client.get("/api/search").json()
    shown = {c["name"] for c in r["matches"] + r["outside"]}
    assert "Omar" not in shown and r["hidden"] >= 1
    # Text search narrows the list.
    r = client.get("/api/search", params={"q": "photography"}).json()
    assert {c["name"] for c in r["matches"] + r["outside"]} <= {"Arjun", "Omar", "Rahul", "Ananya", "Sara"}


def test_meet_anyway_waives_only_my_filters(client, login):
    login("maya")
    set_user("Maya", age_min=30, age_max=32)
    karan = next(c for c in client.get("/api/search").json()["outside"] if c["name"] == "Karan")
    assert client.post("/api/scenes", json={"partner_id": karan["id"]}).status_code == 409
    r = client.post("/api/scenes", json={"partner_id": karan["id"], "waive": True})
    assert r.status_code == 200, r.text
    drain()
    s = client.get("/api/scenes/" + r.json()["id"]).json()
    assert s["status"] == "completed" and s["waived"] is True and not s["incoming"]
    # Waiving never overrides the other person's preferences.
    set_user("Omar", age_min=31)
    omar_id = SessionLocal().scalar(select(User.id).where(User.name == "Omar"))
    assert client.post("/api/scenes", json={"partner_id": omar_id, "waive": True}).status_code == 409


def test_invitation_waits_for_acceptance_when_auto_accept_is_off(client, login):
    maya = login("maya")
    assert client.put("/api/settings", json={"auto_accept": False}).json()["auto_accept"] is False
    login("arjun")
    sid = client.post("/api/scenes", json={"partner_id": maya["id"], "venue": "cafe"}).json()["id"]
    drain()
    assert client.get("/api/scenes/" + sid).json()["status"] == "invited"
    assert client.post(f"/api/scenes/{sid}/respond", json={"accept": True}).status_code == 409  # not the invitee
    login("maya")
    s = client.get("/api/scenes/" + sid).json()
    assert s["incoming"] and s["status"] == "invited" and s["partner"]["name"] == "Arjun"
    assert client.post(f"/api/scenes/{sid}/respond", json={"accept": True}).json()["status"] == "queued"
    drain()
    assert client.get("/api/scenes/" + sid).json()["status"] == "completed"


def test_declined_invitation_never_runs(client, login):
    maya = login("maya")
    client.put("/api/settings", json={"auto_accept": False})
    login("arjun")
    sid = client.post("/api/scenes", json={"partner_id": maya["id"]}).json()["id"]
    login("maya")
    assert client.post(f"/api/scenes/{sid}/respond", json={"accept": False}).json()["status"] == "declined"
    drain()
    assert client.get("/api/scenes/" + sid).json()["status"] == "declined"
