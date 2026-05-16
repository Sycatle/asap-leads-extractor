# web — leads-finder dashboard

Next.js 16 dashboard for the [leads-finder](../README.md) platform. Manages leads, contacts, outbound sequences, senders, templates, the inbox of inbound replies, and admin usage stats.

This package is not meant to be run standalone — it shares the Drizzle schema and queries with the worker. Run it from the repo root via `pnpm web`.

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- Tailwind 4 + Radix UI primitives
- Zod for request validation
- Drizzle ORM (via the shared `db/` package)

## Auth

Basic Auth via `web/src/middleware.ts` (timing-safe compare). Configure accounts with the `ALLOWED_USERS` env var: `user1:pass1,user2:pass2`. If `NODE_ENV=development` and `ALLOWED_USERS` is empty, auth is bypassed.

## Layout

```
web/
├── src/
│   ├── app/
│   │   ├── api/              # Route handlers (see below)
│   │   ├── (pages)/          # Dashboard pages
│   │   └── layout.tsx
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   │   ├── db.ts             # Re-exports db/queries/* for app code
│   │   └── validation.ts     # Zod request schemas
│   └── middleware.ts         # Basic Auth
├── next.config.ts            # Security headers, standalone build
└── package.json
```

## API routes

### Leads & sourcing
- `GET/POST /api/leads`, `/api/leads/[id]` — list, detail, update.
- `POST /api/leads/[id]/{call,followup,history,optout,status}` — per-lead actions.
- `GET /api/leads/next` — next prioritized lead for a call session.

### Sessions & stats
- `GET/POST /api/session` — call session state.
- `GET /api/followups` — upcoming follow-ups.
- `GET /api/stats/gamified` — dashboard counters.
- `GET /api/usage` — LLM usage and cost (admin).
- `GET /api/health` — public health probe.

### Outbound
- `GET/POST /api/contacts` — manage per-lead contacts.
- `GET/POST/DELETE /api/suppression` — global suppression list.
- `GET/POST /api/sequences`, `/api/sequences/[id]`, `/api/sequences/[id]/steps`, `POST /api/sequences/[id]/enroll`.
- `GET/POST /api/templates`, `/api/templates/[id]`.
- `GET/POST /api/senders`, `/api/senders/pools`.
- `GET /api/dns/check` — SPF/DKIM/DMARC checker for a sender domain.

### Inbound & webhooks
- `GET /api/inbox`, `POST /api/inbox` (mark handled).
- `POST /api/webhooks/resend` — Resend events (sent / delivered / open / click / bounce / complaint), Svix-verified.
- `POST /api/webhooks/inbound-email` — inbound replies (Postmark/Resend-Inbound compatible payload).

### Unsubscribe (RFC 8058)
- `GET /api/u/[token]` — public unsubscribe page (HMAC-verified token).
- `POST /api/u/[token]` — one-click endpoint called by Gmail/Yahoo.

## Shared DB layer

All routes import from `@/lib/db`, which re-exports the async queries defined under `db/queries/*`. **Do not** write Drizzle queries inline in route handlers — keep them in `db/queries/` so the worker can reuse them.

## Development

From the repo root:

```bash
pnpm web              # next dev with Turbopack
pnpm web:build        # production build (validates TypeScript)
pnpm lint             # ESLint (root + web)
pnpm test             # vitest (integration tests need Postgres on :5434)
```

See the [root README](../README.md) for full environment setup and migrations.

## Notes

- Pages default to Server Components. Add `"use client"` only when hooks or events require it.
- Use `next/image` for images and `next/link` for internal navigation — never `<img>` or `<a href>`.
- Page metadata via `export const metadata` / `generateMetadata()`, never raw `<head>` tags.
