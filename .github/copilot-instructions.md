# Leads Finder - AI Coding Guidelines

## Architecture Overview

This is a **French B2B lead generation tool** with three main components:

```
shared/         → Shared types, DB schema, migrations (SQLite via better-sqlite3)
worker/         → CLI + background jobs: scrape Google Maps, enrich via Pappers API, CSV import
web/            → Next.js 15 dashboard: lead management, call sessions, followups
data/leads.db   → Single SQLite database shared between worker and web
```

**Data flow:** Google Maps scraping → SQLite → Pappers enrichment → Web dashboard → Call sessions

## Key Conventions

### Database & Types
- **SQLite booleans** are stored as `0/1` integers, transform with `Boolean()` in `web/src/lib/db.ts`
- Types are duplicated: `shared/types.ts` (worker) and `web/src/types/index.ts` (web) - keep synchronized
- Database path auto-resolved via `findDbPath()` - works from root, `/web`, or `/worker`
- Migrations in `shared/migrations.ts` - **never modify existing migrations**, only add new ones

### Worker Commands
```bash
pnpm scrape           # Scrape Google Maps (uses config.json niches/cities)
pnpm enrich           # Enrich leads with Pappers (requires PAPPERS_API_KEY in .env)
pnpm enrich:website   # Analyze websites for CMS, speed, pain points
pnpm collect          # Import CSV from config.input_csv
pnpm worker           # Run continuous loop (scrape → collect → enrich)
pnpm migrate          # Run DB migrations
```

### Web Development
```bash
cd web && pnpm dev    # Start Next.js dev server
# OR from root:
pnpm web
```

### Scoring Logic (Important!)
**Higher score = worse digital presence = better sales prospect.** See `worker/scoring.ts`:
- No website: +25 points
- Platform website (Planity, etc.): +15 points  
- Slow page load: +8 points
- No Google image: +10 points

### Status Flow
Leads follow this pipeline: `nouveau` → `contacte` → `qualifie` → `proposition` → `converti` | `perdu`

Call status: `non_appele` → `appele` | `rappeler` | `injoignable`

## Code Patterns

### API Routes (Next.js App Router)
```typescript
// web/src/app/api/leads/route.ts
import { findLeads, countLeads } from '@/lib/db';
export async function GET(request: NextRequest) {
  const leads = findLeads(filters);
  return NextResponse.json({ leads, total });
}
```

### React Hooks
Custom hooks in `web/src/hooks/` wrap API calls with state management. Example: `useCallSession` manages the call workflow with outcomes, followups, and session tracking.

### UI Components
- Base components in `web/src/components/ui/` (shadcn-style)
- Feature components organized by page: `call/`, `leads/`, `dashboard/`, `followups/`
- Constants for labels/colors in `web/src/lib/constants.ts`

## Configuration

`config.json` at project root defines:
- `scrape.niches` / `scrape.cities`: Google Maps search queries
- `allowed_departments`: French postal code prefixes to filter (e.g., "72", "44")
- `exclude_keywords`: Chain businesses to skip (McDonald's, Carrefour, etc.)

## External Dependencies
- **Pappers API**: French business registry enrichment (SIREN, legal name, dirigeant)
- **Playwright**: Google Maps scraping with anti-detection delays
- **better-sqlite3**: Synchronous SQLite with WAL mode

## Language
- All UI text, status labels, and comments are in **French**
- Variable/function names are in English
