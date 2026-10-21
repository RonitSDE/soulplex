# Architecture and implementation contract

## Runtime

A same-origin React app calls a FastAPI API. The API holds session authentication, consent, memory and eligibility rules. A separate Python worker claims queued scene rows with a conditional database update, builds bounded dialogues, then checks consent/memory again before saving the result. Local demo uses SQLite WAL; the live recipe uses PostgreSQL. There is no Redis dependency for this pilot.

Three.js provides the presentation layer. Its town runs independently of model calls. Selecting a venue selects a server-side scenario; users cannot supply arbitrary agent tools. The figures in the town are an illustration of the chosen experience, not a claim that agents are continuously interacting offscreen.

## Agent roles

| Role               | Inputs                                                                         | Output                                                   | Cannot do                                                                                          |
| ------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Story interviewer  | Own latest answer, last ten chat messages, up to sixteen approved own memories | One follow-up, up to three exact-source memory proposals | Create an approved memory, infer orientation/caste/religion, scrape profiles, diagnose personality |
| Representative A   | A's approved shareable memories, scene premise, public prior scene turns       | One bounded dialogue turn, own source IDs                | Read A's private memories or B's private data, contact anyone, accept a meeting                    |
| Representative B   | B's equivalent limited context                                                 | Same contract                                            | Same restrictions                                                                                  |
| Orchestrator       | Scene state and both memory version numbers                                    | Six alternating turns, references, a human question      | Override eligibility, consent, user choices or spend beyond configured turn bounds                 |
| Moderation adapter | Text being submitted/generated                                                 | Allow or fail closed                                     | Guarantee safety, verify identity or determine compatibility                                       |

No autonomous browsing, shell, money or third-party messaging tools are exposed to these agents. The system prompts treat all supplied personal text as untrusted data. Strict JSON Schema validates shape; evidence-ID ownership validates source availability. Neither proves that every sentence is semantically supported: human review and live evaluation remain necessary.

## Memory pipeline

1. Member answers a question in chat. Voice is optionally recorded locally, explicitly uploaded for transcription, reviewed in the composer, then separately sent.
2. A source message is stored. The interviewer can propose only exact contiguous quotes found in that newest answer.
3. Proposals default to `status=proposed, visibility=private`. The owner can edit, approve, reject or delete them.
4. The private interviewer may use approved private memories. A representative may use only approved **shareable** memories.
5. Approval/edit/deletion increments the owner's `memory_version`. Optimistic per-memory `expected_version` checks avoid overwriting a newer edit.
6. Scene jobs snapshot both user version numbers. Before generation and again before persistence, eligibility and versions are checked.
7. Old scene output/contact is hidden when either version changes. New scenes use current approved memory.
8. Agent output and the other person's text never become the owner's memory automatically. Personal feedback is not shared and is not training consent.

Memory is deliberately transparent SQL retrieval for this pilot, bounded to recent facts. An embedding database is unnecessary at this scale. Add searchable categories and user-pinned canonical memories before introducing vector retrieval. If vector storage is later added, enforce owner/scope filters and deletion there too.

## Consent and matching

Candidates must satisfy verified email in live mode, adult eligibility, operator approval, both discovery opt-ins, same city, same declared intention, reciprocal gender preference, reciprocal age range, and no block/suspension. The system never infers these sensitive preferences from language or images. Self-described is a simple pilot label; richer self-description and taxonomy need user research.

Candidate order is a basic database shortlist (explore orders by shared themes), **not a trained compatibility ranking**. Preview text contains only approved shareable facts. No facial, caste, income or attraction scoring exists. Dubai and Delhi are separate local pools; diaspora does not imply cross-border dating availability.

Each scene has one participation row per person. Contact appears only when:

- The scene is completed and current.
- Both members remain mutually eligible and unblocked.
- Both reviewed the AI exchange, submitted their own contribution and chose `accept`.
- Each had supplied an explicit contact method before accepting.

The partner's contribution is hidden until the viewer supplies theirs. Withdrawal/pass hides contact again. Already-seen information cannot be erased from another person's memory or screenshots; disclosure is irreversible in that limited sense. Sharing is never triggered by a score or a payment.

## Resonance and agent learning (0.5.0)

After the six dialogue turns, the worker runs a reflection step (`app/resonance.py`):

| Output | Visible to | Grounding |
| --- | --- | --- |
| `score`, `confidence`, five `dimensions` (score, reason, known) | both people | approved shareable facts and the dialogue only |
| `shared`, `explore` | both people | same |
| `perspectives[user_id]`: `learned_about_partner`, `noticed_about_you`, `growth` | only that user (`scene_data` strips the other) | same |

The score is a weighted mean of known dimensions, pulled toward 50 by the share of unknown dimensions, so thin profiles cannot look like perfect matches. In live mode a strict-schema model call produces the reflection. If that call fails, the dialogue is kept and a keyword fallback is used, labelled `method: keyword-fallback`. Demo mode always uses `keyword-demo`. The UI shows the method and calls it "a conversation aid, not a verdict". Resonance never gates or unlocks contact.

`GET /api/insights` aggregates the user's current completed scenes: dimension averages, strengths, best venue, recurring shared themes, explore topics, recent growth tips, learned items, decision funnel and private outcome feedback. It also reports trait coverage across the seven categories. Nothing is written back to memory automatically; the owner decides what to teach next.

`POST /api/agent/explore` queues up to three scenes with eligible partners not yet met at the current memory version, rotating venues, under the same eligibility, block, dedupe and daily quota rules as manual scenes.

## State and job behavior

Scene states: `queued`, `running`, `completed`, `failed`. Worker claims use a conditional update, so two workers cannot claim the same queued row successfully. A job has a 480-second upper execution bound; jobs left running for more than 600 seconds are failed when a worker next polls. They are not automatically retried to avoid surprise cost. The member can initiate a fresh scene. A unique key on canonical member pair, venue and memory versions prevents duplicate current jobs across concurrent API requests. Failure releases the key so a member can retry. Other venues get new jobs.

Before running a larger deployment, add a monitored job system and per-user in-flight constraints. The uniqueness constraint is tested in SQLite but not under PostgreSQL load; recovery after a provider call can still incur billable tokens without a persisted output. Provider billing is the cost source of truth.

## Model configuration

`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` select an OpenAI-compatible Chat Completions endpoint with strict JSON Schema, `store:false`, and `max_completion_tokens`. There is no silent fallback to fake dialogue in live mode. Changing an endpoint requires verifying all of those capabilities plus its data policy.

Moderation is a separately configurable endpoint/model/key. Defaults target OpenAI's moderation API. An alternate generation provider does not automatically imply an alternate compatible moderation service. Voice requires `TRANSCRIBE_MODEL` and a compatible `/audio/transcriptions` endpoint. Audio is not written to application storage, although the provider's own retention policy still applies.

The current adapter caps each generated output at 800 completion tokens; a scene makes up to six generation calls plus six moderation calls. Interviewing makes one generation call plus input/output moderation. Test language quality and length/refusal rates before choosing the model. A model key/name must be configured by your team; no unavailable model or unverified price is hardcoded.

Official integration references:

- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/moderation
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://threejs.org/docs/pages/OrbitControls.html

## Storage and data protection

Tables: users, sessions, one-use auth tokens, invitations, messages, memories, scenes, participations, blocks, reports, events, quotas and schema_version. Passwords use salted scrypt with a 64 MiB work factor; older v1 hashes are upgraded at sign-in. Tokens and invitation codes are stored as SHA-256 digests. Live accounts require one-use invitations and email verification before AI use or discovery. Reset links expire after 20 minutes, cannot be reused and revoke sessions. Session cookies are HTTPOnly, SameSite=Lax, Secure in production. Mutations check CSRF and supplied Origin. Role checks are server-side. Text fields and requests have bounds. CSP, HSTS in production, frame protection and API `no-store` headers are set.

The operator dashboard shows member status and reports; it does not expose chat, memories or private contact fields. Operators can suspend/revoke eligibility. Database administrators still have privileged access: protect and audit that infrastructure separately.

PII in the database is currently application-readable, not field-encrypted. Use encrypted managed storage, restricted access, private networking and encrypted backups. Account deletion removes active user data and shared scenes. It does not purge immutable backups automatically. A backup retention/restore-deletion procedure must be established before live use. Deleting an account also removes related reports in this implementation; settle retention obligations and abuse evidence handling before public launch.

Do not log raw prompts, chats, contacts, tokens or audio in telemetry. Provider failure logs contain the job ID and exception class only. The included API command disables access logs. Event rows record action names, not message bodies.

## Scaling and extension seams

First extend the existing invariants; do not bypass them in a new UI:

- Harden email operations with delivery metrics, bounce handling, provider review, operator MFA/SSO and session/device controls. Add an age/identity process with a reviewed data contract.
- Add privacy-reviewed notification jobs; send only after explicit notification consent.
- Add optional daily digest as a replay of actual generated text, not invented video evidence.
- Add billing/entitlements with idempotent payment webhooks and explicit refund logic. Keep safety, blocking, export and deletion free.
- Add calendar/video booking only after both confirm time, channel and counterpart.
- The v1 to v2 column migration and backfill run transactionally on startup. Review and test each later migration, especially against PostgreSQL and backups; do not assume `create_all` updates existing columns.
- Add connection pool/concurrency limits, durable monitoring, recovery drills and automated expiry/retention tasks.
- Add qualitative matching improvements only after observed human outcomes justify them.
