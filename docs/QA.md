# Release 0.4.1 · quality and verification record

## Implemented release

The previous static concept has a separate full-stack implementation: React/TypeScript, actual procedural Three.js rendering, FastAPI, persistent relational data, a separate bounded agent worker, configurable live model calls, conversational onboarding, source-linked approved memories, mutual human introduction, and operator/data controls.

Demo mode is explicitly synthetic and deterministic. It does not call a model or consume tokens. The source package does not update or deploy the earlier public static demo URL.

## Automated verification

- Backend regression suite: 22 tests passed in the current local run.
- TypeScript check and Vite production build passed.
- Tests cover authentication and CSRF, role boundaries, underage input rejection, operator-gated discovery, deletion/export, private memory defaults, ownership, optimistic revisions, contact filtering, mutual human acceptance, withdrawal, stale memory, blocking, pre-run eligibility checks, reciprocal preferences, request size/origin limits, report permissions, venue reuse and deduplicated feedback counts.
- Mocked provider tests cover strict schemas and `store:false`, provider failure without simulated fallback, rejection of invented memory quotes and source IDs from outside the acting representative's approved set. New tests cover one-use invites and verification links, blocked unverified AI access, reset replay/session revocation, legacy password upgrade, unique scene keys, failed-scene retry and an idempotent SQLite v1 to v2 upgrade.
- The QA addendum generated during packaging records the final rerun and native API/worker integration smoke result.

The installed Starlette test client emits an upstream deprecation warning concerning its httpx adapter. The tests pass; do not treat this warning as a product failure or silently change the pinned dependencies without rerunning them.

## Not verified in this build environment

- Real model output, transcription, model spend and provider moderation decisions (no configured live credentials).
- Actual SMTP provider delivery, bounce handling, spam placement and real emailed reset links.
- Docker image/container execution, PostgreSQL runtime or Caddy certificate provisioning (no local Docker daemon).
- Browser screenshot/visual inspection, WebGL hardware, Safari microphone support or mobile interaction QA (browser automation unavailable).
- Load, adversarial security testing, high-concurrency consent races, failover, disaster recovery and jurisdiction-specific launch readiness.

## Browser checklist for the developer

At 390px and 1440px widths: sign up/sign in/out; navigate every tab; rotate and click the three venues; use keyboard venue buttons; test WebGL unavailable and reduced motion; check readable forms and errors. Exercise microphone denied, recorded playback/delete, explicit live transcription and edited text before sending. Confirm no horizontal page overflow, keyboard focus visibility and readable screen-reader labels.

Use two isolated accounts to check no private memory/contact leaks. Verify pending/completed/failed/stale scene states and block both ways. Revoke discovery after a mutual acceptance and ensure contact disappears on reload. Inspect network responses, not only the rendered UI. Run the demo from a clean database as well as after a restart.

## Known limits

This is pilot code, not a security certification. Manual verification is not KYC. Model evidence references do not fully validate meaning. Contact filtering is heuristic. Candidate ordering is a simple eligibility shortlist. A tested SQLite v1 to v2 upgrade exists, but PostgreSQL migration and high-concurrency behavior are not verified here. Rich outcome funnels, operator MFA, worker heartbeat, automated retention, billing and booking remain additional work, documented in Deployment and Architecture.

## Original 0.4.0 packaging verification · 14 October 2026

- Fresh dependency installation from the pinned requirements completed.
- Final backend rerun: **16 passed** (one upstream Starlette/httpx deprecation warning).
- Final frontend build: TypeScript and Vite passed; generated main bundle about 290 kB and separately chunked Three.js about 480 kB before gzip.
- **Native integration smoke passed**: built frontend served over real HTTP; demo authentication and candidate retrieval succeeded; a durable queued scene was completed by a separate worker process with six dialogue turns; contact remained hidden.
- The reproducible smoke script is `scripts/smoke.py`. From the root, with dependencies installed and frontend built, run `.venv/bin/python scripts/smoke.py`. It creates an isolated temporary database, uses an ephemeral localhost port and cleans up both processes and its database.
- Docker/PostgreSQL, live AI credentials and browser/device testing remain unverified as listed above.

## 0.4.1 hardening verification · 14 October 2026

- Current backend suite: **22 passed**, with the existing Starlette/httpx adapter deprecation warning.
- Frontend TypeScript and Vite compilation passed after adding verification, invitation and reset UI. Final rerun should follow packaging.
- The unique scene key is a database constraint; losing concurrent transactions should roll back their quota charge. Unique constraint and retry behavior were tested with SQLite, but simultaneous HTTP requests under PostgreSQL load were not.
- SQLite v1 schema upgrade/backfill and repeat invocation were tested. A staging restore and PostgreSQL run remain required before upgrading a real deployment.
- Password reset and email verification were exercised with a stub mail sender. SMTP and the live model path have not been called with production credentials.
