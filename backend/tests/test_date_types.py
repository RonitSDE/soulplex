import asyncio
import pytest
from provider_stub import run_dialogue
from app.date_types import DATE_TYPES, pick
from app.worker import process_one


def drain():
    while asyncio.run(process_one()):
        pass


A = {"id": "a", "name": "Asha", "facts": [{"id": "1", "category": "interests", "content": "I love books"}, {"id": "2", "category": "values", "content": "Kindness matters"}]}
B = {"id": "b", "name": "Bilal", "facts": [{"id": "3", "category": "lifestyle", "content": "I walk every morning"}]}


@pytest.mark.parametrize("type_id", list(DATE_TYPES))
def test_every_date_type_runs_four_steps(type_id):
    out, _ = asyncio.run(run_dialogue(type_id, A, B))
    lines = out["dialogue"]
    assert len(lines) == 8 and [l["stage"] for l in lines] == [0, 0, 1, 1, 2, 2, 3, 3]
    assert all(l["fact_ids"] and l["mood"] for l in lines)
    assert "{" not in "".join(l["text"] for l in lines)  # every template placeholder filled


def test_agents_pick_a_date_from_shared_themes():
    assert pick(["books", "reading"], "x") == "bookshop"
    assert pick(["walks", "the outdoors"], "x") == "walk"
    assert pick([], "seed") in DATE_TYPES


def test_auto_and_explicit_types_and_listing(client, login):
    login("maya")
    cands = client.get("/api/candidates").json()["candidates"]
    assert client.post("/api/scenes", json={"partner_id": cands[0]["id"], "venue": "bowling"}).status_code == 422
    r1 = client.post("/api/scenes", json={"partner_id": cands[0]["id"], "venue": "sunset"}).json()
    r2 = client.post("/api/scenes", json={"partner_id": cands[1]["id"]}).json()  # agents pick
    drain()
    s1 = client.get("/api/scenes/" + r1["id"]).json()
    s2 = client.get("/api/scenes/" + r2["id"]).json()
    assert s1["venue"] == "sunset" and s2["venue"] in DATE_TYPES
    page = client.get("/api/dates", params={"limit": 1}).json()
    assert page["total"] == 2 and len(page["items"]) == 1
    assert "dialogue" not in page["items"][0]["output"]  # list rows stay light
    assert client.get("/api/dates", params={"type": "sunset"}).json()["total"] == 1
    assert client.get("/api/dates", params={"status": "waiting"}).json()["total"] == 2
    best = client.get("/api/dates", params={"sort": "score"}).json()["items"]
    scores = [d["output"]["assessment"]["score"] for d in best]
    assert scores == sorted(scores, reverse=True)


def test_island_live_dates_show_spots_but_never_conversations(client, login):
    login("maya")
    cands = client.get("/api/candidates").json()["candidates"]
    r = client.post("/api/scenes", json={"partner_id": cands[0]["id"], "venue": "walk"}).json()
    data = client.get("/api/island").json()
    assert data["active"] == 1 and data["by_type"]["walk"] == 1 and data["agents"] > 5
    (live,) = data["live"]
    assert live["type"] == "walk" and live["spot"] in (0, 1) and live["mine"] is True
    assert {live["a"]["name"], live["b"]["name"]} == {"Maya", cands[0]["name"].split()[0]}
    flat = str(data)
    assert "dialogue" not in flat and "contact" not in flat and "@" not in flat
    assert client.get("/api/scenes/" + r["id"]).json()["spot"] == live["spot"]


def test_island_spots_never_overlap_and_overflow_waits(client, login):
    login("maya")
    cands = client.get("/api/candidates").json()["candidates"]
    for c in cands[:3]:  # Sunset Pier has 2 spots
        client.post("/api/scenes", json={"partner_id": c["id"], "venue": "sunset"})
    spots = [x["spot"] for x in client.get("/api/island").json()["live"] if x["type"] == "sunset"]
    assert sorted(x for x in spots if x is not None) == [0, 1] and spots.count(None) == 1


def test_every_date_type_has_an_island_with_two_or_three_spots():
    names = {t["island"] for t in DATE_TYPES.values()}
    assert len(names) == 10
    assert all(2 <= len(t["spots"]) <= 3 for t in DATE_TYPES.values())
