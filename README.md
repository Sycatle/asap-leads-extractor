# leads-finder

Outil de génération de leads B2B : scraping Google Maps → enrichissement (Societe.com, analyse de site web) → dashboard de qualification et de prospection.

## Architecture

```
┌────────────┐      ┌──────────────────┐      ┌────────────┐
│  worker/   │──────▶│ SQLite (WAL)     │◀─────│   web/     │
│ scrapers + │      │ data/leads.db    │      │ Next.js 16 │
│ enrichers  │      └──────────────────┘      │ dashboard  │
└────────────┘             ▲                  └────────────┘
                           │
                     shared/queries/
                  (prepared statements)
```

- **`worker/`** — pipelines Playwright orchestrés (`SCRAPE`, `ENRICH_SOCIETE`, `ENRICH_WEBSITE`). Écrit dans SQLite.
- **`web/`** — Next.js 16 / React 19 / Tailwind 4. Lit/écrit SQLite via `shared/queries/`. Auth Basic via middleware.
- **`shared/`** — couche DB (better-sqlite3, mode WAL), 22 migrations versionnées, query builders paramétrés.

## Stack

| Couche | Tech |
|---|---|
| Runtime | Node.js + tsx, pnpm@10.15.0 |
| DB | SQLite (better-sqlite3), WAL |
| Scraping | Playwright |
| Web | Next.js 16, React 19, Tailwind 4, Radix UI, Zod |
| Process manager | PM2 (`ecosystem.config.cjs`) |
| Reverse proxy | nginx (TLS Cloudflare origin) |

## Quick start

```bash
pnpm install
cp .env.example .env   # remplir PAPPERS_API_KEY + ALLOWED_USERS
pnpm migrate           # crée le schéma SQLite
pnpm web               # dashboard sur http://localhost:3000
pnpm worker            # orchestrateur de pipelines
```

## Variables d'environnement

| Var | Description |
|---|---|
| `PAPPERS_API_KEY` | Clé API pappers.fr pour enrichissement entreprise |
| `ALLOWED_USERS` | Comptes Basic Auth, format `user1:pass1,user2:pass2`. Obligatoire en prod. |
| `NODE_ENV` | `development` désactive l'auth si `ALLOWED_USERS` vide |

**Ne jamais commiter `.env`** (déjà dans `.gitignore`).

## Scripts utiles

```bash
pnpm migrate:status     # liste migrations appliquées/en attente
pnpm migrate:rollback   # rollback de la dernière migration
pnpm stats              # stats CLI sur la base
pnpm scrape             # un cycle de scrape Google Maps
pnpm enrich             # un cycle d'enrichissement Societe.com
pnpm enrich:website     # analyse de sites web (CMS, SSL, mobile)
pnpm backup             # backup WAL-safe via sqlite3 .backup
pnpm config:import      # importe config.json en DB
```

## Déploiement

```bash
./deploy.sh             # install + build web + migrate + pm2 reload
pm2 status              # leadflow-web, leadflow-worker, leadflow-backup
pm2 logs leadflow-worker
```

PM2 redémarre le worker chaque jour à 6h et exécute un backup à 2h (rotation 7 jours).

## Documentation

- `docs/DATABASE.md` — schéma, tables, index
- `docs/MIGRATIONS.md` — système de migrations
- `docs/SOCIETE_COM_SCRAPER.md` — scraper Societe.com
- `docs/WEBSITE_ANALYSIS.md` — analyse de site web et pain points
- `docs/archive/` — plans historiques

## Sécurité

- Toutes les requêtes SQL passent par `prepare()` + placeholders nommés (`shared/queries/`)
- Soft-delete via `deleted_at` (aucun `DELETE` destructif sur les leads)
- Auth Basic + comparaison timing-safe sur **toutes** les routes (`web/src/middleware.ts`)
- Headers de sécurité (HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options) dans `next.config.ts`
- nginx ajoute CSP, Permissions-Policy, et le filtrage des bots
