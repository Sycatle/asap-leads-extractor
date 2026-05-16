# Societe.com enrichment

Free company-data enrichment for French leads, used as the primary source for SIREN, dirigeant and legal form. Pappers is kept as a paid fallback.

## What it extracts

For each lead matched against societe.com, the scraper updates these `leads` columns:

| Column | Source field |
|---|---|
| `siren` | SIREN number (9 digits) |
| `legal_name` | Dénomination on the company sheet |
| `dirigeant` | First-listed dirigeant (`{name} ({role})`) |
| `forme_juridique` | SARL / SAS / SASU / EI / EURL / … |

## Where it lives

| File | Role |
|---|---|
| `worker/enrichSociete.ts` | Playwright scraper (search + sheet parsing, anti-bot delays). |
| `worker/enrich.ts` | Orchestrates a batch enrichment cycle (selects leads, persists results). |
| `db/queries/leads.ts` | Update helpers used after a successful scrape. |

The scraper reuses the Chromium singleton from `worker/browserPool.ts` when run inside the orchestrator; standalone runs spawn their own browser.

## Run it

```bash
# Batch enrichment (default cycle size)
pnpm enrich

# Inside the orchestrator (intervals from config.json)
pnpm worker
```

The orchestrator runs `enrichSociete` on its configured interval; the CLI command above runs a single cycle.

## Anti-bot behavior

Societe.com tolerates moderate scraping:

- **User-Agent** — realistic desktop Chrome string.
- **Browser flags** — `--disable-blink-features=AutomationControlled` to avoid trivial bot detection.
- **Pacing** — random 2–4 s delay between requests (`MIN_DELAY` / `MAX_DELAY` in `enrichSociete.ts`).
- **No parallelism** — one request at a time per browser context.
- **Timeout** — 30 s per page (`REQUEST_TIMEOUT`).

A CAPTCHA may still appear after ~100 consecutive requests. The scraper logs the failure and moves on; the lead stays eligible for a later retry.

## Matching strategy

1. Search query: `name + city` against `/cgi-bin/search?champs=…`.
2. Parse the result list.
3. Pick the best match by city + name similarity (no fuzzy match library yet — substring comparison).
4. Fetch the company sheet and extract the fields above.

If no result matches, the lead is left untouched and counted as `enrichment_failed` for the cycle.

## Failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| All requests time out | Network or IP block | Pause the cycle, check from a different IP. |
| Empty result lists | Selector drift after a site change | Update the selectors at the top of `enrichSociete.ts`. |
| CAPTCHA pages | Burst of requests | Reduce daily volume or insert a longer cooldown. |
| Wrong company matched | Name collisions in the city | Prefer Pappers fallback for the lead. |

## Pappers fallback

When `PAPPERS_API_KEY` is set and Societe.com fails for a lead, the enrichment can fall back to the Pappers API (paid, structured JSON). Pappers is the recommended source for high-value leads or when Societe.com is throttling.

## Performance budget

Approximate timing on a small VPS:

- ~3–5 s per lead end-to-end.
- 200 leads / day at the default pacing keeps you well under the CAPTCHA threshold.
- 2 600 leads ≈ 2 h 10 min if you bypass pacing (not recommended).

## Tuning

Constants live at the top of `worker/enrichSociete.ts`:

```ts
const MIN_DELAY = 2000;
const MAX_DELAY = 4000;
const REQUEST_TIMEOUT = 30000;
```

Set `DEBUG=1` for verbose scraper logs.

## Out of scope

- Bulk historical re-enrichment (no current job).
- Multi-language matching (FR only).
- Storing the company sheet URL (only the extracted fields are persisted).
