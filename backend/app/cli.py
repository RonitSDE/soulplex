"""Operator provisioning is deliberately unavailable through the public API."""

import argparse
import secrets
import time
from sqlalchemy import select
from .db import init_db, SessionLocal, User, Invite
from .security import DEMO, digest

p = argparse.ArgumentParser()
p.add_argument("command", choices=["init", "promote", "invite"])
p.add_argument("--email")
p.add_argument("--count", type=int, default=1)
p.add_argument("--days", type=int, default=14)
args = p.parse_args()
init_db()
if args.command == "promote":
    with SessionLocal() as db:
        u = db.scalar(select(User).where(User.email == args.email))
        if not u:
            raise SystemExit("Register the operator account first.")
        if not DEMO and not u.email_verified:
            raise SystemExit("Verify the operator email before promotion.")
        u.role = "admin"
        db.commit()
        print("Operator role granted.")
elif args.command == "invite":
    if not 1 <= args.count <= 50 or not 1 <= args.days <= 90:
        raise SystemExit("Use 1-50 invitations and a 1-90 day expiry.")
    with SessionLocal() as db:
        for _ in range(args.count):
            raw = secrets.token_urlsafe(24)
            db.add(Invite(token=digest(raw), expires=time.time() + args.days * 86400))
            print(raw)
        db.commit()
else:
    print("Schema initialized.")
