import asyncio
from app.about import clean, facts, violates, signals
from app.worker import process_one

ABOUT = {
    "pronouns": "she", "height_cm": 166, "job": "a nurse", "languages": ["English", "Hindi"],
    "family_plans": "want", "timeline": "within_year", "drinking": "no", "smoking": "no",
    "diet": "vegetarian", "sleep": "early_bird", "religion": "hindu", "religion_importance": "very",
    "love_languages": ["time"], "prompts": [{"id": "sunday", "answer": "Temple in the morning, then dosa."}],
}


def test_clean_rejects_bad_values():
    assert clean(ABOUT)["diet"] == "vegetarian"
    for bad in ({"diet": "pizza"}, {"height_cm": 300}, {"prompts": [{"id": "x", "answer": "hi"}]}, {"dealbreakers": ["height"]}):
        try:
            clean(bad)
            raise AssertionError(bad)
        except ValueError:
            pass


def test_facts_and_dealbreakers():
    sentences = [s for _, _, s in facts(ABOUT)]
    assert "I'm vegetarian." in sentences and "I don't smoke." in sentences
    me = {**ABOUT, "dealbreakers": ["smoking", "family_plans", "diet"]}
    assert violates(me, {"smoking": "sometimes"})
    assert violates(me, {"family_plans": "dont_want"})
    assert violates(me, {"diet": "non_veg"})
    assert not violates(me, {"diet": "jain", "family_plans": "open"})
    assert not violates(me, {})  # unknown answers never exclude


def test_signals_flag_conflicts():
    s = signals({"family_plans": "want"}, {"family_plans": "dont_want"}, "A", "B")
    assert s[0][0] == "future" and s[0][1] < 0 and s[0][2] == "explore"


def test_about_endpoint_generates_traits_and_filters(client, login):
    login("maya")
    r = client.put("/api/about", json={**ABOUT, "dealbreakers": ["smoking"]})
    assert r.status_code == 200, r.text
    assert r.json()["about"]["diet"] == "vegetarian" and r.json()["about_complete"] > 50
    mem = client.get("/api/memories").json()
    assert any(m["source_id"] == "about:diet" and m["status"] == "approved" for m in mem)
    names = [c["name"] for c in client.get("/api/candidates").json()["candidates"]]
    assert "Daniel" not in names  # Daniel smokes sometimes
    # Saving again replaces, not duplicates, the generated traits.
    client.put("/api/about", json=ABOUT)
    assert sum(m["source_id"] == "about:diet" for m in client.get("/api/memories").json()) == 1
    assert "Daniel" in [c["name"] for c in client.get("/api/candidates").json()["candidates"]]
    assert client.put("/api/about", json={"job": "call me 0501234567 now"}).status_code == 422


def test_profile_signals_reach_resonance(client, login):
    login("maya")
    client.put("/api/about", json={**ABOUT, "family_plans": "want"})
    karan = next(c for c in client.get("/api/candidates").json()["candidates"] if c["name"] == "Karan")
    assert karan["about"]["diet"] == "vegetarian" and "dealbreakers" not in karan["about"]
    sid = client.post("/api/scenes", json={"partner_id": karan["id"]}).json()["id"]
    asyncio.run(process_one())
    a = client.get("/api/scenes/" + sid).json()["output"]["assessment"]
    assert "Aligned on family plans" in a["shared"] and "Similar food habits" in a["shared"]


def test_intentions_match_when_adjacent():
    from app.domain import intents_fit

    assert intents_fit("marriage", "relationship") and intents_fit("relationship", "dating")
    assert not intents_fit("marriage", "dating")
