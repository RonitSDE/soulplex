import asyncio
from app.worker import process_one
from app.resonance import heuristic, finalize


def drain():
    while asyncio.run(process_one()):
        pass


def test_assessment_is_scored_and_perspective_is_private(client, login):
    maya = login("maya")
    partner = client.get("/api/candidates").json()["candidates"][0]
    sid = client.post("/api/scenes", json={"partner_id": partner["id"]}).json()["id"]
    drain()
    s = client.get("/api/scenes/" + sid).json()
    a = s["output"]["assessment"]
    assert 0 <= a["score"] <= 100
    assert [d["name"] for d in a["dimensions"]] == [
        "values",
        "lifestyle",
        "communication",
        "future",
        "interests",
    ]
    assert "perspectives" not in a
    assert a["perspective"]["growth"]
    assert a["method"] == "keyword-demo"
    # Partner sees their own perspective, not Maya's.
    login("arjun")
    other = client.get("/api/scenes/" + sid).json()["output"]["assessment"]
    assert other["perspective"] != a["perspective"]


def test_owner_can_write_trait_and_it_invalidates_scenes(client, login):
    u = login("maya")
    r = client.post(
        "/api/memories",
        json={"category": "future", "content": "I want to settle down in Dubai."},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"
    assert client.get("/api/me").json()["user"]["memory_version"] > u["memory_version"]
    bad = client.post(
        "/api/memories",
        json={"category": "future", "content": "mail me at me@example.com"},
    )
    assert bad.status_code == 422
    assert (
        client.post(
            "/api/memories", json={"category": "astrology", "content": "Leo"}
        ).status_code
        == 422
    )


def test_explore_queues_dates_once_per_memory_version(client, login):
    login("maya")
    r = client.post("/api/agent/explore", json={"count": 3})
    assert r.status_code == 200, r.text
    assert len(r.json()["started"]) == 3
    drain()
    again = client.post("/api/agent/explore", json={"count": 3}).json()
    assert {x["partner"] for x in again["started"]}.isdisjoint(
        {x["partner"] for x in r.json()["started"]}
    )


def test_insights_aggregate_learnings(client, login):
    login("maya")
    empty = client.get("/api/insights").json()
    assert empty["dates"] == [] and empty["average"] is None
    assert 0 < empty["knowledge"] <= 100
    client.post("/api/agent/explore", json={"count": 2})
    drain()
    data = client.get("/api/insights").json()
    assert len(data["dates"]) == 2
    assert data["average"] is not None
    assert data["growth"]
    assert data["learned"]
    # Structured profile answers make the future dimension measurable.
    assert "future" in data["dimensions"]


def test_thin_profiles_cannot_look_like_perfect_matches():
    a = {"id": "a", "name": "A", "facts": [{"id": "1", "category": "interests", "content": "I love books"}]}
    b = {"id": "b", "name": "B", "facts": [{"id": "2", "category": "interests", "content": "Books are my life"}]}
    r = finalize(heuristic(a, b, []), "keyword-demo")
    assert r["confidence"] == "low"
    assert r["score"] < 65
