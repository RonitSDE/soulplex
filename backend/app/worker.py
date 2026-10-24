"""Durable DB-backed bounded jobs. Run separately: python -m app.worker."""

import asyncio, time, os, logging
from sqlalchemy import select, update
from .db import SessionLocal, Scene, User, init_db
from .domain import scene_ok, stale, actor_data
from .ai import run_dialogue, ProviderError
from .minds import enabled as minds_enabled, bind_mind, judge_score
from .resonance import assess
from .security import log

logging.basicConfig(level=logging.INFO)


async def process_one():
    with SessionLocal() as db:
        db.execute(
            update(Scene)
            .where(Scene.status == "running", Scene.started < time.time() - 1100)
            .values(
                status="failed",
                dedupe_key=None,
                error="Worker timed out. Start a new experience.",
            )
        )
        db.commit()
        sid = db.scalar(
            select(Scene.id)
            .where(Scene.status == "queued")
            .order_by(Scene.created)
            .limit(1)
        )
        if not sid:
            return False
        claimed = db.execute(
            update(Scene)
            .where(Scene.id == sid, Scene.status == "queued")
            .values(status="running", started=time.time())
        )
        db.commit()
        if not claimed.rowcount:
            return True
        scene = db.get(Scene, sid)
        a, b = db.get(User, scene.a), db.get(User, scene.b)
        if not scene_ok(db, scene, a, b) or stale(scene, a, b):
            scene.status = "failed"
            scene.dedupe_key = None
            scene.error = "Profiles changed. Start a fresh experience."
            db.commit()
            return True
        try:
            if minds_enabled():
                await bind_mind(db, a)
                await bind_mind(db, b)
                db.commit()
        except ProviderError as exc:
            scene.status = "failed"
            scene.dedupe_key = None
            scene.error = str(exc)
            db.commit()
            return True
        aa, bb = actor_data(db, a), actor_data(db, b)
        venue = scene.venue
        sid = scene.id
    try:
        if not aa["facts"] or not bb["facts"]:
            raise ProviderError(
                "Both representatives need approved shareable memories."
            )
        output, tokens = await asyncio.wait_for(
            run_dialogue(venue, aa, bb, sid),
            timeout=900 if minds_enabled() else 480,
        )
        assessment, extra = await asyncio.wait_for(
            assess(aa, bb, output["dialogue"]), timeout=120
        )
        if minds_enabled() and aa.get("mind_id") and bb.get("mind_id"):
            try:
                assessment["score"] = await asyncio.wait_for(
                    judge_score(sid, aa, bb, output["dialogue"]), timeout=80
                )
                assessment["method"] = "minds"
            except Exception:
                logging.warning("Mind score unavailable; keeping the reflection score")
        output["assessment"] = assessment
        tokens += extra
        with SessionLocal() as db:
            s = db.get(Scene, sid)
            if not s:
                return True
            a, b = db.get(User, s.a), db.get(User, s.b)
            if not scene_ok(db, s, a, b) or stale(s, a, b):
                s.status = "failed"
                s.dedupe_key = None
                s.error = "Consent or memory changed during the experience."
            else:
                s.output = output
                s.tokens = tokens
                s.model = (
                    "hellominds"
                    if minds_enabled() and aa.get("mind_id") and bb.get("mind_id")
                    else os.environ.get("AI_MODEL", "")
                )
                s.status = "completed"
                log(db, a, "scene_completed", sid)
            db.commit()
    except Exception as exc:
        with SessionLocal() as db:
            s = db.get(Scene, sid)
            if s:
                s.status = "failed"
                s.dedupe_key = None
                s.error = (
                    str(exc)
                    if isinstance(exc, ProviderError)
                    else "The experience could not complete. Please try again."
                )
                db.commit()
        logging.warning("Scene job %s failed (%s)", sid, type(exc).__name__)
    return True


async def loop():
    init_db()
    while True:
        if not await process_one():
            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(loop())
