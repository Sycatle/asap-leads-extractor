# Leads Finder - AI Coding Guidelines

## Architecture Overview

French B2B lead generation tool, **Postgres + Drizzle + Docker** stack:

```
db/             → Drizzle schema (db/schema.ts) + async queries (db/queries/*) + migrations
worker/         → Pipelines Playwright (scrape GMaps, enrich Societe.com, enrich site web,
                  agent LLM mentions légales via Anthropic SDK) + orchestrateur multi-pipelines
web/            → Next.js 16 dashboard : lead management, call sessions, followups, usage LLM
shared/         → Types partagés (Config, enums, RawLead) — la DB layer est dans db/
docker/         → Dockerfiles worker + web ; docker-compose.yml orchestre tout
```

**Data flow** : Google Maps scraping → Postgres → enrichissement Societe.com + analyse site +
mentions-légales via Claude → Dashboard prospection avec sessions d'appel.

## Key Conventions

### Database & Types
- **Source de vérité** : `db/schema.ts` (Drizzle). Types `Lead`, `NewLead`, etc. inférés via
  `typeof leads.$inferSelect`. Worker et web utilisent `db/queries/*` (async).
- **Pas de prepared SQLite** : tous les wrappers `getDb().prepare(...).all()` ont été supprimés.
  Utiliser le query builder Drizzle (`db.select().from(leads).where(eq(...))`).
- **Soft-delete** : toujours filtrer `isNull(leads.deletedAt)` sauf intention explicite.
- **Migrations** : `pnpm migrate` lance drizzle-kit. Pour ajouter une migration :
  modifier `db/schema.ts` → `pnpm migrate:generate` → commit le SQL généré.

### Worker pipelines
- L'orchestrateur (`worker/orchestrator.ts`) gère 4 pipelines : `scrape`,
  `enrichSociete`, `enrichWebsite`, `enrichLegal`. Chacun a son intervalle et son
  budget par cycle, paramétrables via `config.json`.
- `worker/browserPool.ts` : Browser Chromium singleton partagé entre `enrichWebsite`
  et `enrichLegal` (refcount-based, hot-reload sur crash).
- L'agent LLM `enrichLegal` enregistre chaque appel dans `llm_usage` (cost tracking) ;
  budget mensuel via `LEGAL_BUDGET_USD`.

### Web
- Toutes les routes `/api/*` sont async, importent depuis `@/lib/db` qui re-exporte
  `db/queries/*`. Pas de Drizzle inline dans les routes.
- Auth Basic en middleware, timing-safe compare. `ALLOWED_USERS=user1:pass1,...`.
- Stats LLM exposées sur `/admin/usage`, healthcheck sur `/api/health` (public).

### Tests
- Vitest avec `fileParallelism: false` (intégration Postgres partagée).
- Tests d'intégration sur `leads_test` DB ; `DATABASE_URL` requis.
- E2E Playwright dans `worker/legalNavigation.test.ts` (mini-server http local).
