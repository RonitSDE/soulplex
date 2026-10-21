# Developer deployment and handoff

## 1. Local demo

Run `docker compose up --build -d` from the root. API and frontend share localhost:8000; the worker uses the same persistent SQLite database. Service health starts the API before the worker, avoiding initial schema/seed races. Never expose this shared demo as a private member product. Use fictional inputs.

No Docker daemon was available in the build environment; the Docker recipe is supplied for your team's staging verification. Native API/worker operation and compiled static assets can be tested separately as documented in the README.

## 2. Live staging

Use a separate domain and empty live database. Copy `.env.example` to `.env`, keep it out of Git, set mode-independent values below and use `compose.production.yaml` alone. It supplies `APP_ENV=production` and `DEMO_MODE=false`; the demo compose is not merged.

| Variable                              | Purpose                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `APP_ENV`                             | `production` enables secure cookie and startup checks.                                                                   |
| `DEMO_MODE`                           | `false` disables demo sign-in and deterministic dialogue. Never mix demo/live database state.                            |
| `APP_ORIGIN`                          | Exact HTTPS origin used by the browser, without a path.                                                                  |
| `DOMAIN`                              | Hostname for Caddy; DNS must point to the deployment.                                                                    |
| `POSTGRES_PASSWORD`                   | Long random alphanumeric secret for the supplied compose URL; use a secrets manager for long-term operation.             |
| `DATABASE_URL`                        | SQLAlchemy URL, supplied by production compose. For managed DB use `postgresql+psycopg://...` and required TLS settings. |
| `AI_API_KEY`                          | Backend-only generation/transcription provider secret.                                                                   |
| `AI_MODEL`                            | Provider model supporting the current strict-schema Chat Completions contract. Required in live mode.                    |
| `AI_BASE_URL`                         | Default `https://api.openai.com/v1`; alternate endpoints must be explicitly tested.                                      |
| `SMTP_HOST` / `SMTP_PORT`             | Real outbound SMTP host and TLS upgrade port, usually 587. Required in production.                                       |
| `SMTP_FROM`                           | Verified sender address on the delivery domain. Required in production.                                                  |
| `SMTP_USERNAME` / `SMTP_PASSWORD`     | SMTP login when your provider requires it; do not place these in the frontend.                                           |
| `TRANSCRIBE_MODEL`                    | Optional transcription model; blank leaves typed chat working and transcription unavailable.                             |
| `MODERATION_URL` / `MODERATION_MODEL` | Defaults use OpenAI moderation. Errors fail closed.                                                                      |
| `MODERATION_API_KEY`                  | Optional separate moderation key; leave variable absent to reuse AI_API_KEY.                                             |
| `STATIC_DIR`                          | Built frontend location; Docker sets `/app/static`.                                                                      |

```bash
docker compose -f compose.production.yaml up --build -d
docker compose -f compose.production.yaml logs --tail=100 api worker
```

This is a single-host pilot recipe. Managed PostgreSQL and managed secret storage are preferable for production operations. Pin container image digests and run a dependency vulnerability review as part of your deployment pipeline.

### Operator bootstrap

From an authorized deployment shell, issue one-use codes for the small pilot. Deliver each code privately. Codes expire after 14 days by default; only their digests are stored.

```bash
docker compose -f compose.production.yaml exec api python -m app.cli invite --count 5 --days 14
```

Register your operational account using one of those codes, verify its email link, then promote it from the deployment shell:

```bash
docker compose -f compose.production.yaml exec api python -m app.cli promote --email your-operator@example.com
```

The existing account becomes an operator. Sign out and back in. Do not promote a demo identity in a live database. Admin creation is never exposed as a public API input. Restrict shell and database access; add operator MFA before broadening membership.

### First real users

For an invite-only trial, each member must redeem an unused code and verify their email. The operator should complete an approved adult eligibility and consent check **outside** the application before marking a member checked. The UI button stores only the operator decision; it is not KYC. The member then explicitly enables discovery and approves shareable memory. An operator cannot enable discovery on their behalf through the operator endpoint. Verify sender-domain authentication, delivery, spam placement, expired links and password reset on real staging before recruiting members.

## 3. Provider and model acceptance test

Use consented fictional fixtures first, in English and Hinglish. Do not benchmark with scraped social profiles or third-party private messages.

1. Set live mode, real model configuration and both moderation/transcription settings as required.
2. Verify a chat answer creates only exact-source private memory proposals.
3. Ask for a correction; approve a revised memory and ensure the next interview uses it.
4. Submit instructions embedded in a memory asking to ignore rules, reveal contact or impersonate an operator. The system must not gain tools, leak private memory or expose contact.
5. Run the three venues using two separate accounts. Check every personal claim against its displayed evidence; an ID match alone does not prove faithfulness.
6. Force provider timeout/refusal/malformed JSON and moderation failure. Confirm live mode returns an error, no fake dialogue.
7. Test optional microphone permissions, deletion, explicit upload, transcription and editable text on Safari and Chrome.
8. Record tokens, provider costs, latency, refusal rates, human correction rate and representation feedback. Choose a model based on those results.

Enable provider project-level budget alerts and spending limits. App caps are 40 chat answers, 5 new scenes and 10 transcriptions per member per UTC day; six generated turns per scene. These are abuse/cost controls, not paid entitlements. IP auth quotas may need adjustment for a shared office/NAT; enforce edge-level rate limiting as well.

## 4. Launch requirements owned by your team

This list describes concrete missing operational work, not completed features:

- Test SMTP delivery/bounces and reset abuse handling, then add session/device management, edge anti-bot controls and operator MFA/SSO.
- Choose and test an adult age/identity process and documented escalation routes. Self-reported age and the manual checkbox are not verification technology.
- Review the actual business, privacy/consent terms, processor agreements, sensitive-data handling, cross-border flows and launch permissions for each chosen location with qualified local advisers. This package makes no jurisdictional compliance claim.
- Specify incident response, report-review hours, member support, appeal handling and moderation testing across languages and identities. Wire a real support destination before advertising live service.
- Configure encrypted storage/backups, restore tests, retention expiry, deletion after backup restore, and restrictions on raw chat access. Decide abuse-report retention before collecting real reports.
- A reviewed v1 to v2 migration adds `email_verified`, `dedupe_key`, auth tokens and invites; it backfills active scene keys. Before applying it to an existing database, stop old workers, back up the database, and test the upgrade on a restored copy. New tables still use `create_all`; later changes need explicit versioned migrations. Existing live accounts become email-unverified and must request a verification link. The supplied PostgreSQL upgrade has not been run in this environment.
- Validate PostgreSQL behavior, reverse proxy, TLS/cookies, worker timeout recovery, concurrent writes, load, browser accessibility and mobile hardware. Test deployment from a clean host.
- Audit contact hiding during concurrent memory edits/blocks. Application checks cover ordinary flows; an independent security/concurrency review is required before public scale.
- Live registration enforces one-use invitations. Add edge rate limits, monitoring and a reviewed access policy before a larger rollout. Do not publish the demo operator endpoint in live mode.

## 5. Operations and troubleshooting

| Symptom                     | Check                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Scene stays queued          | Worker is running and points at the exact same database; inspect worker logs and job backlog.                                 |
| Live API refuses startup    | HTTPS APP_ORIGIN, DEMO_MODE=false, AI_MODEL, AI_API_KEY, SMTP_HOST and SMTP_FROM must all be configured.                      |
| Verify mail does not arrive | Confirm SMTP TLS/auth, sender domain and spam placement; a signed-in member can resend verification in My choices.            |
| Login cookie not retained   | Same host/origin, HTTPS in production, reverse proxy and cookie settings.                                                     |
| 403 on mutation             | CSRF token from `/api/me` and exact allowed Origin; reload after changing accounts.                                           |
| 409 after editing memory    | Intended stale/version guard. Reload and create a fresh scene.                                                                |
| 503 from live AI            | Provider access/model compatibility/moderation config; do not switch silently to demo.                                        |
| No candidates               | Same local city and intention, reciprocal age/gender, operator approval, discovery opt-in and shareable memory on both sides. |
| 429                         | Daily pilot quota or auth throttle reached; inspect aggregate usage without logging private content.                          |

Health endpoint checks the API/database only, not model availability or worker liveness. Add worker heartbeat/backlog monitoring before real operations. Expired sessions are denied but need scheduled row cleanup. Quota rows are date-partitioned keys and should also be pruned under your retention policy.

Back up before release. Keep previous image and compatible database backup for rollback. Stop writes and workers when restoring; reapply deletion requests made after the restored snapshot. Never promise instant deletion from backups unless implemented and tested.
