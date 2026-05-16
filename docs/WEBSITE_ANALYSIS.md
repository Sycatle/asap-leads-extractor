# Website analysis

Per-lead website audit that powers the dashboard's "pain points" section. Helps sales conversations open on a concrete, factual weakness of the prospect's online presence.

## What it does

### CMS & quality detection
- Detects the CMS / platform: WordPress, Wix, Shopify, PrestaShop, Squarespace, Webflow, custom, or "no real site" (Planity, Facebook, etc.).
- Flags quality issues:
  - Mobile-friendly viewport.
  - HTTPS / SSL.
  - Page load time (Playwright timing).
  - Modern vs outdated markup.

### Pain-point generation
Context-aware bullets, persisted on the lead and surfaced on the call page.

**No website:**
- "Aucun site web — invisible sur Google"
- "Perte de clients potentiels au profit de concurrents en ligne"
- Niche-specific recommendations (e.g. coiffeurs → online booking).

**Platform-only listings (Planity, Facebook, …):**
- "Plateforme de réservation ≠ vrai site web"
- "Pas de contrôle sur image / contenu"
- "Frais mensuels élevés + commissions"

**CMS-specific:**
- Wix → "Site Wix — limité pour le SEO".
- WordPress (slow) → "WordPress mal optimisé — besoin de refonte".
- Generic slow site → load-time + mobile pain points.

### Sales-call surface
The pain points are rendered in `web/src/components/call/CurrentLeadCard.tsx` between the script and the history blocks, with an alert style so reps can't miss them.

## Run it

```bash
# Enrich the next batch of pending leads
pnpm enrich:website
```

Behavior:
1. Up to 50 leads per run.
2. Priority order: high / medium first.
3. Skip leads already analyzed.
4. Generate pain points for leads without a website.
5. Deep Playwright analysis for real sites.

## Schema

Columns on `leads` (Postgres types):

| Column | Type | Notes |
|---|---|---|
| `cms_type` | `text` | `wordpress` / `wix` / `shopify` / `prestashop` / `squarespace` / `webflow` / `custom` / `none` |
| `has_mobile_friendly` | `boolean` | viewport meta + responsive heuristics |
| `has_ssl` | `boolean` | HTTPS reachable |
| `page_load_time` | `integer` | milliseconds (null if not analyzed) |
| `pain_points` | `jsonb` | array of bullets persisted as JSON |

## Scoring impact

Website signals are folded into the lead score (`worker/scoring.ts`):

- Wix sites: +12 points (SEO limitations make them strong prospects).
- Slow WordPress: +8 points (optimization upsell).
- Shopify: +5 points (high running cost, custom-build opportunity).
- "No real site": classified accordingly so reps know what they're walking into.

## Performance

- Concurrency: 2 (`p-limit`).
- Per-site timeout: 15 s.
- Errors are logged and the lead is left untouched (next run will retry).

## Detection logic

### CMS heuristics

| CMS | Markers |
|---|---|
| WordPress | `/wp-content/`, `/wp-includes/`, `wp-json` |
| Wix | `wix.com`, `_wix_`, `parastorage.com` |
| Shopify | `cdn.shopify.com`, `Shopify.theme` |
| PrestaShop | `/modules/ps_`, `prestashop` |
| Squarespace | `squarespace.com`, `sqsp.com` |
| Webflow | `webflow.com`, `data-wf-` |

### Mobile-friendly

- Viewport meta with `width=device-width`.
- Responsive keywords / media-query density.

### Performance bands

- Fast: < 2 000 ms.
- Acceptable: 2 000–3 000 ms.
- Slow: > 3 000 ms (generates a pain point).

## Files

| File | Role |
|---|---|
| `worker/websiteAnalyzer.ts` | Core Playwright analyzer. |
| `worker/enrichWebsite.ts` | Batch entry point used by `pnpm enrich:website`. |
| `worker/scoring.ts` | Lead-score adjustments based on website signals. |
| `web/src/components/call/CurrentLeadCard.tsx` | Renders the pain-point block on the call page. |
| `web/src/lib/db.ts` | Lead transform that exposes the fields to the frontend. |
| `shared/types.ts` | `CMSType` and related shared types. |

## Future improvements

- Lighthouse integration for deeper perf scores.
- SEO checks (meta tags, structured data, sitemap).
- Accessibility (WCAG).
- Periodic re-analysis for old leads.
- Editable pain points from the dashboard.
- Screenshot capture for visual reference.

## Troubleshooting

**No pain points displayed.**
Check that `pnpm enrich:website` has been run and the lead row has `pain_points` populated. Browser console errors usually point to bad JSON on legacy rows.

**Analysis fails.**
Ensure Playwright browsers are installed (`pnpm exec playwright install`). Check outbound network. The 15 s timeout is per site; raise it for slow targets in `enrichWebsite.ts`.

**Too slow.**
Reduce the concurrency limit in `enrichWebsite.ts` or schedule the job during off-hours.

## Security

- Playwright runs headless in a sandboxed browser.
- No credentials or payloads sent to analyzed sites.
- Rate-limited to avoid hammering targets.
- Only metadata is persisted; no page contents are stored.
