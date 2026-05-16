# leads-finder

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-22%2B-brightgreen.svg)](https://nodejs.org)
[![Postgres](https://img.shields.io/badge/postgres-17-336791.svg)](https://www.postgresql.org)

Self-hosted B2B lead generation and outbound platform. Scrapes Google Maps for local businesses, enriches them with company data (Societe.com, Pappers, mentions légales via an LLM agent), runs multi-step email sequences with deliverability monitoring and AI reply classification — all behind a Next.js dashboard. GDPR-first.

## Features

### Sourcing & Enrichment
- Google Maps scraping by niche + city (Playwright).
- Company enrichment: SIREN, dirigeant, forme juridique (Societe.com scraper + Pappers fallback).
- Website analysis: CMS detection, SSL/mobile/perf checks, auto-generated pain points.
- Legal-mentions extraction via an LLM agent (Claude) — RCS, capital, hosting provider, contact email.
- LLM cost tracked per feature with monthly budget cap.

### Outbound & Deliverability
- Multi-step email sequences (email + wait + conditional branching).
- Sender pools with round-robin, daily limits, sending windows (timezone-aware).
- Warmup ramp (5 → 10 → 20 → 50 → 100/day over 4 weeks) and per-sender health monitoring.
- RFC 8058 one-click unsubscribe + auto-injected GDPR footer on every email.
- Global suppression list (cross-sequence) — same email blocked everywhere after one opt-out.
- Resend integration via an adapter pattern (`ISendingProvider`) — swap in another provider without touching the runner.
- Inbound webhook + Claude Haiku reply classifier (positive / negative / neutral / OOO / wrong-person / unsubscribe / question) with automatic dispatch (suppression, pause, qualify, etc.).
- Consent log + 3-year retention purge (CNIL-compliant).

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│    worker/      │──────▶│   Postgres 17    │◀─────│      web/       │
│ scrapers +      │      │  (Docker volume) │      │  Next.js 16     │
│ enrichers +     │      └──────────────────┘      │  dashboard +    │
│ sequence runner │              ▲                 │  inbox + REST   │
│ + reply agent   │              │                 └─────────────────┘
└─────────────────┘         db/queries/                    │
                          (Drizzle ORM)                    │
                                                  ┌────────┴────────┐
                                                  │ Resend (SMTP)   │
                                                  │ Inbound webhook │
                                                  └─────────────────┘
```

- **`worker/`** — orchestrated Playwright pipelines (`SCRAPE`, `ENRICH_SOCIETE`, `ENRICH_WEBSITE`, `ENRICH_LEGAL`), the email `sequenceRunner`, the reply classifier (Claude Haiku), and cron jobs (purge, sender-health, warmup-ramp).
- **`web/`** — Next.js 16 / React 19 / Tailwind 4 dashboard. Basic Auth middleware. Reads/writes Postgres through the shared Drizzle layer.
- **`db/`** — Drizzle schema (25 tables, native Postgres types), versioned migrations via `drizzle-kit`, async queries shared between worker and web.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 22 + tsx, pnpm 10 |
| Database | Postgres 17 + Drizzle ORM |
| Scraping | Playwright |
| LLM agents | Anthropic SDK (Claude Opus 4.7 default, Haiku 4.5 for reply classification) |
| Email | Resend SDK + Svix (webhook signature verification) |
| Web | Next.js 16, React 19, Tailwind 4, Radix UI, Zod |
| Containers | Docker Compose (worker + web + postgres + migrate) |
| Reverse proxy | nginx (TLS termination, security headers, rate-limit) |

## Quick start (Docker)

```bash
cp .env.example .env             # fill DATABASE_URL, ANTHROPIC_API_KEY, ALLOWED_USERS, RESEND_API_KEY
docker compose up -d              # postgres + migrate + worker + web
docker compose logs -f worker     # follow the orchestrator
# Dashboard: http://localhost:3000 (Basic Auth via ALLOWED_USERS)
```

## Quick start (local dev)

```bash
pnpm install
docker compose up -d postgres     # or a local Postgres on 5432
cp .env.example .env              # DATABASE_URL=postgresql://leads:leads@localhost:5434/leads
pnpm migrate                       # apply drizzle-kit migrations
pnpm web                           # dashboard
pnpm worker                        # orchestrator (in another terminal)
```

## Environment variables

| Var | Description |
|---|---|
| `DATABASE_URL` | Postgres URL (default `postgresql://leads:leads@localhost:5434/leads` for dev, `postgresql://leads:leads@postgres:5432/leads` inside Docker) |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Provisioning vars for the `postgres` Docker service |
| `ALLOWED_USERS` | Basic Auth accounts, format `user1:pass1,user2:pass2`. Required in production. |
| `NODE_ENV` | `development` disables auth when `ALLOWED_USERS` is empty |
| `ANTHROPIC_API_KEY` | Claude API key (legal-mentions agent + reply classifier) |
| `LEGAL_AGENT_MODEL` | Claude model for legal extraction (default `claude-opus-4-7`) |
| `LEGAL_CONCURRENCY` | Parallel legal pipelines (default 2) |
| `LEGAL_BUDGET_USD` | Rolling 30-day USD cap (0 = unlimited) |
| `REPLY_CLASSIFIER_MODEL` | Claude model for inbound classification (default `claude-haiku-4-5`) |
| `PAPPERS_API_KEY` | pappers.fr key for enrichment fallback |
| `RESEND_API_KEY` | Resend API key for outbound email |
| `RESEND_WEBHOOK_SECRET` | Svix secret to verify Resend webhooks |
| `UNSUB_TOKEN_SECRET` | HMAC secret for one-click unsubscribe tokens (≥ 16 chars) |
| `APP_DOMAIN` | Public domain used to build unsubscribe URLs (e.g. `app.example.com`) |
| `INBOUND_DOMAIN` | MX domain for inbound parsing (e.g. `inbound.example.com`) |
| `ADMIN_NOTIFY_EMAIL` | Address that receives sender-health alerts + positive-reply notifications |

## Scripts

```bash
pnpm migrate              # drizzle-kit migrate (apply pending SQL)
pnpm migrate:generate     # generate a migration from db/schema.ts
pnpm migrate:studio       # open Drizzle Studio (browser UI)
pnpm db:up / pnpm db:down # docker compose start/stop postgres

pnpm worker               # multi-pipeline orchestrator
pnpm scrape               # one Google Maps scrape cycle
pnpm enrich               # Societe.com enrichment
pnpm enrich:website       # website analysis (CMS, SSL, mobile)
pnpm enrich:legal         # LLM agent: visit legal pages, extract RCS / capital / email / host

pnpm cli stats            # leads stats (CLI)
pnpm cli purge            # GDPR retention purge (--apply to commit)
pnpm cli sender-health    # daily sender health aggregation
pnpm cli warmup-ramp      # advance warmup ramp for active senders
pnpm cli sequence-tick    # process one batch of due enrollments

pnpm test                 # vitest (integration tests need Postgres on :5434)
pnpm lint                 # ESLint root + web
```

## Deployment

```bash
docker compose up -d --build      # build images then start
docker compose ps                  # check services
docker compose logs -f worker
```

The one-shot `migrate` service (depends on `postgres` healthy) applies pending Drizzle migrations before worker and web start.

For ops procedures (backup/restore, secret rotation, incident playbook, email-pipeline monitoring), see [`docs/OPS.md`](docs/OPS.md).

## Documentation

- [`docs/OPS.md`](docs/OPS.md) — ops runbook (deployment, backup, restore, monitoring).
- [`docs/SOCIETE_COM_SCRAPER.md`](docs/SOCIETE_COM_SCRAPER.md) — Societe.com enrichment guide.
- [`docs/WEBSITE_ANALYSIS.md`](docs/WEBSITE_ANALYSIS.md) — website analysis and pain points.
- [`docs/archive/`](docs/archive) — historical planning documents (not authoritative).

## Security & GDPR

- Drizzle schema is the single source of truth (worker + web) — no raw SQL from callers.
- Soft-delete via `deleted_at` (no destructive `DELETE` on leads).
- Basic Auth + timing-safe compare on **every** route (`web/src/middleware.ts`).
- Security headers (HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options) in `next.config.ts`; nginx adds CSP, Permissions-Policy, rate-limit, bot filtering.
- Postgres container isolated on the internal Docker network with a persistent volume.
- **Global suppression list**: any opt-out blocks the email across all sequences forever.
- **GDPR footer auto-injected** on every outbound email + `List-Unsubscribe` headers (RFC 8058, required by Gmail/Yahoo since Feb 2024).
- **Consent log** per contact (legitimate interest evidence, opt-out timestamps).
- **3-year retention purge** (`pnpm cli purge`) — contacts inactive for 3 years are soft-deleted and added to the suppression list.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, conventions, and PR checklist. By submitting a contribution you agree to license it under Apache 2.0.

## License

Apache License 2.0 — see [`LICENSE`](LICENSE).
