# leads-finder — AI coding guidelines

## Architecture

French B2B lead generation tool, **Postgres + Drizzle + Docker** stack:

```
db/             → Drizzle schema (db/schema.ts) + async queries (db/queries/*) + migrations
worker/         → Playwright pipelines (scrape GMaps, enrich Societe.com, enrich website,
                  LLM agent for legal mentions via Anthropic SDK) + multi-pipeline orchestrator
                  + email sequence runner + reply classifier + cron jobs (purge, sender-health, warmup)
web/            → Next.js 16 dashboard: leads, contacts, sequences, templates, inbox, usage
shared/         → Shared types (Config, enums, RawLead) — DB layer lives in db/
docker/         → Dockerfiles for worker + web; docker-compose.yml orchestrates everything
```

**Sourcing flow:** Google Maps → Postgres → Societe.com + website analysis + legal mentions via Claude → dashboard.

**Outbound flow:** dashboard enrolls contacts in a sequence → `sequenceRunner` ticks every minute, picks due enrollments, selects a sender from the pool, renders the template, appends the GDPR footer, sends via Resend → events flow back through `/api/webhooks/resend` → inbound replies hit `/api/webhooks/inbound-email`, the reply classifier dispatches actions (suppression / pause / qualify).

## Key conventions

### Database & types
- **Source of truth:** `db/schema.ts` (Drizzle). Types `Lead`, `NewLead`, etc. inferred via `typeof leads.$inferSelect`. Worker and web both use `db/queries/*` (async).
- Use the Drizzle query builder (`db.select().from(leads).where(eq(...))`) — no raw SQL from callers.
- **Soft-delete:** always filter `isNull(leads.deletedAt)` unless intentionally including deleted rows.
- **Migrations:** `pnpm migrate` runs drizzle-kit. To add a migration: edit `db/schema.ts` → `pnpm migrate:generate` → commit the generated SQL.

### Worker pipelines
- The orchestrator (`worker/orchestrator.ts`) runs four pipelines: `scrape`, `enrichSociete`, `enrichWebsite`, `enrichLegal`. Each has its own interval and per-cycle budget, configurable via `config.json`.
- `worker/browserPool.ts`: Chromium singleton shared between `enrichWebsite` and `enrichLegal` (refcount-based, hot-reload on crash).
- The `enrichLegal` LLM agent records every call in `llm_usage` (cost tracking); monthly cap via `LEGAL_BUDGET_USD`.

### Outbound
- **Sequence runner** (`worker/pipelines/sequenceRunner.ts`): picks `enrollments WHERE status='active' AND next_run_at <= now()`, advances steps, persists `email_events`. Run via `pnpm cli sequence-tick`.
- **Sender adapter pattern** (`worker/sending/`): the `ISendingProvider` interface lets a new provider (Smartlead, Instantly, …) be added without touching the runner. `resendProvider.ts` is the current implementation.
- **Suppression invariant:** the suppression list is **global** — one opt-out blocks the email across all sequences. Always call `isSuppressed(db, email)` before sending.
- **Unsub tokens** (`worker/sending/unsubToken.ts`): HMAC-SHA256 over base64url JSON, 90-day default TTL, requires `UNSUB_TOKEN_SECRET` (>= 16 chars). Verify with `timingSafeEqual`.
- **Reply classifier** (`worker/agents/replyClassifier.ts`): Claude Haiku 4.5 with `zodOutputFormat`, cost tracked via `llm_usage` (feature `reply_classifier`). Triggered on inbound emails by `/api/webhooks/inbound-email`.
- **Reply actions** (`worker/agents/replyActions.ts`): switch on intent (`positive` → qualify lead + notify, `unsub_request` → suppress + pause, `ooo` → defer, …).

### Web
- All `/api/*` routes are async and import from `@/lib/db`, which re-exports `db/queries/*`. No inline Drizzle in route handlers.
- Basic Auth in middleware, timing-safe compare. `ALLOWED_USERS=user1:pass1,...`.
- LLM usage stats at `/admin/usage`, public health probe at `/api/health`.
- Inbound replies feed `/inbox` (admin view) — `lead_emails.handled = false` until a human acts.

### Tests
- Vitest with `fileParallelism: false` (shared Postgres integration DB).
- Integration tests target the `leads_test` database; `DATABASE_URL` required, default `postgresql://leads:leads@localhost:5434/leads_test`.
- E2E Playwright in `worker/legalNavigation.test.ts` (mini local HTTP server).
