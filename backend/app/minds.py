"""Server-side Hello Minds client.

The builder key stays in the process environment. Nothing here is safe to call from the browser.
Wire shapes follow @animocabrands/minds-client-lib 0.1.7:
  POST /v1/minds/awaken            {id, mindName}
  POST /v1/messaging/conversation  {alias, mindId}
  POST /v1/messaging/message       {alias, messageText}
  GET  /v1/messaging/histories/{alias}
  POST /v1/circles/{mindId}        {emails}
"""

import asyncio
import logging
import os
import re
import time
from urllib.parse import quote

import httpx

log = logging.getLogger("soulplex.minds")


class MindsError(Exception):
    def __init__(self, message, status=0):
        super().__init__(message)
        self.status = status


def enabled():
    return bool(os.getenv("MINDS_BUILDER_API_KEY", "").strip())


def match_line():
    """A real connection is offered only when the date score reaches this line."""
    try:
        value = int(os.getenv("MATCH_SCORE_MIN", "70"))
    except ValueError:
        value = 70
    return max(0, min(100, value))


def _base():
    return os.getenv("MINDS_API_BASE", "https://api.build.hellominds.ai").rstrip("/")


def _mind_type():
    return os.getenv("MINDS_MIND_TYPE", "mastermind").strip() or "mastermind"


def _fail(message):
    from .ai import ProviderError

    raise ProviderError(message)


async def _request(method, path, *, body=None, query=None, timeout=30):
    if not enabled():
        raise MindsError("MINDS_BUILDER_API_KEY is not set.", 401)
    try:
        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            response = await client.request(
                method,
                _base() + path,
                headers={
                    "X-Api-Key": os.environ["MINDS_BUILDER_API_KEY"].strip(),
                    "Content-Type": "application/json",
                },
                json=body,
                params=query,
            )
    except httpx.HTTPError as exc:
        raise MindsError("Hello Minds could not be reached.") from exc
    if response.status_code >= 400:
        detail = ""
        try:
            payload = response.json()
            detail = str(payload.get("message") or payload.get("msg") or payload.get("error") or "")
        except ValueError:
            detail = response.text[:180]
        raise MindsError(detail or f"Hello Minds returned {response.status_code}.", response.status_code)
    if not response.content:
        return {}
    try:
        return response.json()
    except ValueError as exc:
        raise MindsError("Hello Minds returned an unreadable response.") from exc


def _mind_name(name, user_id):
    clean = re.sub(r"[^A-Za-z0-9]+", " ", name or "").strip()
    clean = re.sub(r"\s+", " ", clean)[:24] or "Soul"
    suffix = re.sub(r"[^A-Za-z0-9]", "", user_id)[:8] or "agent"
    return f"{clean} {suffix}"


def _ids(data):
    if not isinstance(data, dict):
        return "", ""
    mind_id = str(data.get("mindId") or data.get("mind_id") or "")
    email = str(data.get("email") or data.get("mindEmail") or "")
    return mind_id, email


async def awaken(name):
    data = await _request(
        "POST",
        "/v1/minds/awaken",
        body={"id": _mind_type(), "mindName": name, "language": "en"},
        timeout=40,
    )
    mind_id, email = _ids(data)
    if mind_id and not email:
        detail = await _request("GET", "/v1/minds/" + quote(mind_id, safe=""))
        _, email = _ids(detail)
        mind_id = mind_id or _ids(detail)[0]
    if not mind_id:
        raise MindsError("Hello Minds awakened an agent but did not return its id.")
    return mind_id, email


async def ensure_conversation(alias, mind_id):
    try:
        await _request(
            "POST",
            "/v1/messaging/conversation",
            body={"alias": alias, "mindId": mind_id},
        )
    except MindsError as exc:
        if exc.status not in (400, 409):
            raise
        existing = await _request(
            "GET", "/v1/messaging/conversations/" + quote(alias, safe="")
        )
        bound = existing.get("mindId") if isinstance(existing, dict) else None
        if bound and bound != mind_id:
            raise MindsError("That conversation belongs to a different Mind.", 409)


async def _history(alias):
    rows = await _request(
        "GET",
        "/v1/messaging/histories/" + quote(alias, safe=""),
        query={"limit": 30},
        timeout=25,
    )
    return rows if isinstance(rows, list) else []


def _is_mind(row):
    if not isinstance(row, dict):
        return False
    if row.get("senderType") == 1 or row.get("senderName") == "You":
        return False
    if row.get("senderType") in (0, 2) or row.get("mindId"):
        return True
    name = row.get("senderName")
    return bool(name and name != "You")


async def say(alias, mind_id, text, timeout):
    """Send one message and wait until a new Mind line appears. None on timeout."""
    await ensure_conversation(alias, mind_id)
    seen = set()
    try:
        for row in await _history(alias):
            if row.get("fingerprint"):
                seen.add(row["fingerprint"])
    except MindsError:
        seen = set()
    await _request(
        "POST",
        "/v1/messaging/message",
        body={"alias": alias, "messageText": text[:6000]},
        timeout=40,
    )
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        for row in await _history(alias):
            fingerprint = row.get("fingerprint")
            if fingerprint and fingerprint in seen:
                continue
            if not _is_mind(row):
                if fingerprint:
                    seen.add(fingerprint)
                continue
            body = str(row.get("messageText") or "").strip()
            if body and body != text.strip():
                return body[:2000]
        await asyncio.sleep(2)
    return None


async def teach(mind_id, user_id, text):
    """Hand an approved fact to the Mind. Does not wait for a reply."""
    if not enabled() or not mind_id or not text:
        return
    try:
        alias = "you-" + user_id
        await ensure_conversation(alias, mind_id)
        await _request(
            "POST",
            "/v1/messaging/message",
            body={"alias": alias, "messageText": text[:4000]},
            timeout=40,
        )
    except MindsError as exc:
        log.warning("Mind training was not delivered (%s)", exc.status or type(exc).__name__)


async def bind_mind(db, user):
    """Awaken a Mind for this person and teach it the facts they already approved."""
    if not enabled() or not user or user.mind_id:
        return
    name = _mind_name(user.name, user.id)
    try:
        try:
            mind_id, email = await awaken(name)
        except MindsError as exc:
            if exc.status != 409:
                raise
            mind_id, email = await awaken(name + " " + user.id.replace("-", "")[:4])
    except MindsError as exc:
        _fail("Your agent could not be created on Hello Minds. " + str(exc))
    user.mind_id = mind_id
    user.mind_email = email or ""
    db.flush()
    from .domain import memories

    facts = memories(db, user.id, True)
    lines = [f"- ({m.category}) {m.content}" for m in facts[:16]]
    brief = (
        f"You are {user.name}'s Soulplex agent. Speak as them, in the first person, and only from facts they approved. "
        f"They are looking for a {user.intent} in {user.city}, with people aged {user.age_min} to {user.age_max}. "
        "Never invent a life story, and never share a phone number, email, or link. "
        "Approved shareable facts:\n" + ("\n".join(lines) if lines else "(none yet)")
    )
    await teach(mind_id, user.id, brief)


def _requirements(person):
    intent = person.get("intent") or "relationship"
    city = person.get("city") or "their city"
    return (
        f"Looking for a {intent} in {city}, "
        f"ages {person.get('age_min', 18)}–{person.get('age_max', 80)}."
    )


def _facts_block(person):
    rows = []
    for fact in person.get("facts") or []:
        rows.append(f"- {fact['content']}")
    return "\n".join(rows) if rows else "(none)"


def cited(text, facts):
    low = (text or "").lower()
    found = []
    for fact in facts or []:
        content = str(fact.get("content") or "").strip().lower()
        snippet = content[:48]
        if len(snippet) >= 12 and snippet in low:
            found.append(fact["id"])
    return found


async def private_reply(user, message, facts):
    """One turn with the person's own Mind. Returns None if it does not reply in time."""
    if not user.mind_id:
        return None
    known = "\n".join(f"- ({f.get('category', '')}) {f.get('content', '')}" for f in facts[:16]) or "(none yet)"
    prompt = (
        f"You are {user.name}'s private Soulplex agent. This chat is only with {user.name}. "
        "Be warm and brief. Anything you should remember for a future date still needs their approval, "
        "so do not treat this message as a saved fact. "
        f"They want a {user.intent} in {user.city}. Approved facts you may rely on:\n{known}\n\n"
        f"Their message:\n{message}"
    )
    try:
        return await say("you-" + user.id, user.mind_id, prompt, 75)
    except MindsError as exc:
        _fail("Your agent could not reply. " + str(exc))


async def date_line(scene_id, person, other_name, spec, stage, transcript, turn):
    """One spoken line from this person's Mind, using only their approved facts."""
    from .ai import contains_contact, moderate

    prompt = (
        f"You are {person['name']}'s representative on a Soulplex date with {other_name}'s representative. "
        "Speak in the first person, in 1 to 3 sentences, as if you are sitting together. "
        f"Date: {spec['name']}. {spec.get('blurb', '')} "
        f"Step: {stage['title']}. {stage.get('premise', '')} "
        f"This person's requirements: {_requirements(person)} "
        "You may mention ONLY these approved facts. Do not invent experiences, promises, or attraction. "
        "Do not share a phone number, email address, or link.\n"
        f"{_facts_block(person)}\n\n"
        "Conversation so far:\n"
        + ("\n".join(transcript) if transcript else "(you speak first)")
        + f"\n\nTurn {turn}. Reply with only the spoken line."
    )
    alias = f"date-{scene_id}-{person['id']}"
    try:
        line = await say(alias, person["mind_id"], prompt, 90)
    except MindsError as exc:
        _fail("A Mind could not speak on this date. " + str(exc))
    if line and contains_contact(line):
        try:
            line = await say(
                alias,
                person["mind_id"],
                "Rewrite your last line with no email, phone number, or link. Keep it to 1 to 3 sentences.",
                60,
            )
        except MindsError as exc:
            _fail("A Mind could not speak on this date. " + str(exc))
    if not line:
        _fail("A Mind did not reply in time. Start the date again when Hello Minds is responding.")
    if contains_contact(line):
        _fail("An agent response included contact details and was rejected.")
    await moderate(line)
    return line[:1200]


async def judge_score(scene_id, a, b, dialogue):
    """A Mind that was not on the date reads the transcript and returns 0–100."""
    mind_id = await _judge_id()
    lines = []
    for turn in dialogue:
        lines.append(f"{turn.get('speaker', 'Agent')}: {turn.get('text', '')}")
    prompt = (
        "You are scoring a Soulplex date. You did not attend it. "
        "Using only the transcript and the approved facts below, reply with one JSON object and nothing else: "
        '{"score": <integer 0 to 100>}. '
        "50 means there is not enough to tell. Do not infer health, appearance, or a guaranteed relationship.\n"
        f"Person A requirements: {_requirements(a)}\nFacts:\n{_facts_block(a)}\n"
        f"Person B requirements: {_requirements(b)}\nFacts:\n{_facts_block(b)}\n"
        "Transcript:\n" + "\n".join(lines)
    )
    try:
        text = await say("judge-" + scene_id, mind_id, prompt, 75)
    except MindsError as exc:
        raise MindsError("The match score could not be requested. " + str(exc)) from exc
    match = re.search(r'"score"\s*:\s*(\d{1,3})', text or "")
    if not match:
        raise MindsError("The match score did not come back as a number.")
    return max(0, min(100, int(match.group(1))))


async def _judge_id():
    from .db import SessionLocal, Setting

    with SessionLocal() as db:
        row = db.get(Setting, "judge_mind_id")
        if row and row.value:
            return row.value
    try:
        mind_id, email = await awaken("Soulplex Judge")
    except MindsError as exc:
        if exc.status != 409:
            raise
        mind_id, email = await awaken("Soulplex Judge " + str(int(time.time()))[-4:])
    with SessionLocal() as db:
        existing = db.get(Setting, "judge_mind_id")
        if existing and existing.value:
            return existing.value
        db.merge(Setting(key="judge_mind_id", value=mind_id))
        db.merge(Setting(key="judge_mind_email", value=email or ""))
        db.commit()
    return mind_id


async def link_pair(mind_a, email_a, mind_b, email_b):
    """After both people accept, let the two Minds into each other's circle."""
    if not enabled():
        return
    pairs = ((mind_a, email_b), (mind_b, email_a))
    if not all(mind and email for mind, email in pairs):
        log.warning("Skipped Mind circles because one agent has no Mind email yet.")
        return
    for mind_id, email in pairs:
        try:
            await _request(
                "POST",
                "/v1/circles/" + quote(mind_id, safe=""),
                body={"emails": [email], "isActive": True},
                timeout=30,
            )
        except MindsError as exc:
            log.warning("Mind circle was not updated (%s)", exc.status or type(exc).__name__)
