# leads-finder

Outil de génération de leads B2B : scraping Google Maps → enrichissement (Societe.com, analyse de site web, mentions-légales via agent LLM) → dashboard de qualification et de prospection.

## Architecture

```
┌────────────┐      ┌──────────────────┐      ┌────────────┐
│  worker/   │──────▶│  Postgres 17     │◀─────│   web/     │
│ scrapers + │      │  (Docker volume) │      │ Next.js 16 │
│ enrichers  │      └──────────────────┘      │ dashboard  │
└────────────┘             ▲                  └────────────┘
                           │
                       db/queries/
                  (Drizzle ORM async)
```

- **`worker/`** — pipelines Playwright orchestrés (`SCRAPE`, `ENRICH_SOCIETE`, `ENRICH_WEBSITE`, `ENRICH_LEGAL` agent LLM Claude). Écrit dans Postgres.
- **`web/`** — Next.js 16 / React 19 / Tailwind 4. Lit/écrit Postgres via le même layer Drizzle. Auth Basic via middleware.
- **`db/`** — schéma Drizzle (13 tables, types Postgres natifs), migrations versionnées par drizzle-kit, queries async partagées worker↔web.

## Stack

| Couche | Tech |
|---|---|
| Runtime | Node.js 22 + tsx, pnpm@10.15.0 |
| DB | Postgres 17 + Drizzle ORM |
| Scraping | Playwright |
| LLM agent | Anthropic SDK (Claude Opus 4.7 par défaut) |
| Web | Next.js 16, React 19, Tailwind 4, Radix UI, Zod |
| Containers | Docker Compose (worker + web + postgres + migrate) |
| Reverse proxy | nginx (TLS Cloudflare origin) |

## Quick start (Docker)

```bash
cp .env.example .env             # remplir DATABASE_URL + ANTHROPIC_API_KEY + ALLOWED_USERS
docker compose up -d              # postgres + migrate + worker + web
docker compose logs -f worker     # suivre l'orchestrateur
# Dashboard : http://localhost:3000 (Basic Auth via ALLOWED_USERS)
```

## Quick start (dev local, Postgres host)

```bash
pnpm install
docker compose up -d postgres     # ou : Postgres local sur 5432
cp .env.example .env              # DATABASE_URL=postgresql://leads:leads@localhost:5434/leads
pnpm migrate                       # drizzle-kit migrate
pnpm web                           # dashboard
pnpm worker                        # orchestrateur (autre terminal)
```

## Variables d'environnement

| Var | Description |
|---|---|
| `DATABASE_URL` | URL Postgres (par défaut `postgresql://leads:leads@localhost:5434/leads` côté dev, `postgresql://leads:leads@postgres:5432/leads` côté Docker) |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Provision Postgres dans docker-compose |
| `ANTHROPIC_API_KEY` | Clé API Claude pour l'agent LLM mentions-légales (`enrich:legal`) |
| `LEGAL_AGENT_MODEL` | Modèle Claude utilisé (défaut `claude-opus-4-7`) |
| `LEGAL_CONCURRENCY` | Pipelines mentions-légales en parallèle (défaut 2) |
| `LEGAL_BUDGET_USD` | Budget USD rolling 30j (défaut 0 = illimité) |
| `PAPPERS_API_KEY` | Clé API pappers.fr pour enrichissement entreprise |
| `ALLOWED_USERS` | Comptes Basic Auth, format `user1:pass1,user2:pass2`. Obligatoire en prod. |
| `NODE_ENV` | `development` désactive l'auth si `ALLOWED_USERS` vide |

## Scripts utiles

```bash
pnpm migrate              # drizzle-kit migrate (applique les SQL pending)
pnpm migrate:generate     # génère une migration depuis db/schema.ts
pnpm migrate:studio       # ouvre Drizzle Studio (UI navigateur)
pnpm db:up / db:down      # docker compose start/stop postgres

pnpm worker               # orchestrateur multi-pipelines
pnpm scrape               # un cycle de scrape Google Maps
pnpm enrich               # enrichissement Societe.com
pnpm enrich:website       # analyse de sites web (CMS, SSL, mobile)
pnpm enrich:legal         # agent LLM : visite mentions-légales et extrait RCS/capital/email/hébergeur
pnpm stats                # stats CLI

pnpm test                 # vitest (intégration Postgres requis)
pnpm lint                 # ESLint root + web
```

## Déploiement

```bash
docker compose up -d --build      # builds images puis up
docker compose ps                  # vérifie services
docker compose logs -f worker
```

Le service `migrate` (one-shot, dépend de postgres healthy) applique les migrations Drizzle avant que worker et web démarrent.

## Documentation

- `docs/DATABASE.md` — schéma, tables, index *(ancien — sera ré-écrit pour Postgres)*
- `docs/MIGRATIONS.md` — système de migrations *(remplacé par drizzle-kit)*
- `docs/SOCIETE_COM_SCRAPER.md` — scraper Societe.com
- `docs/WEBSITE_ANALYSIS.md` — analyse de site web et pain points
- `docs/OPS.md` — runbook ops (déploiement, backup, restauration)
- `docs/archive/` — plans historiques

## Sécurité

- Schéma Drizzle = source de vérité unique (worker + web), pas de SQL dynamique côté caller
- Soft-delete via `deleted_at` (aucun `DELETE` destructif sur les leads)
- Auth Basic + comparaison timing-safe sur **toutes** les routes (`web/src/middleware.ts`)
- Headers de sécurité (HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options) dans `next.config.ts`
- nginx ajoute CSP, Permissions-Policy, rate-limit, filtrage des bots
- Container Postgres isolé sur réseau Docker interne, volume persistant pour la data
