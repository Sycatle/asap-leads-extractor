# Website Analysis Feature

## Overview

This feature enriches leads with website technology analysis and pain points to help sales teams have more effective conversations.

## What It Does

### 1. Website Technology Detection
- Detects CMS platforms (WordPress, Wix, Shopify, PrestaShop, Squarespace, Webflow, Custom)
- Identifies website quality issues:
  - Mobile-friendliness
  - HTTPS/SSL security
  - Page load performance
  - Modern vs outdated design

### 2. Pain Points Generation
Automatically generates context-specific pain points based on:

**No Website:**
- "❌ Aucun site web - invisible sur Google"
- "📉 Perte de clients potentiels au profit de concurrents en ligne"
- Niche-specific recommendations (e.g., coiffeurs need online booking)

**Platform Sites (Planity, Facebook, etc.):**
- "📱 Plateforme de réservation ≠ vrai site web"
- "❌ Pas de contrôle sur votre image/contenu"
- "💰 Frais mensuels élevés + commissions"

**CMS-Specific Issues:**
- Wix: "⚠️ Site Wix - limité pour le SEO"
- WordPress (slow): "🔧 WordPress mal optimisé - besoin de refonte"
- Generic: Performance and mobile optimization issues

### 3. Sales Call Integration
Pain points are displayed prominently on the call page with:
- Red/orange gradient background to draw attention
- Bullet-point list of all identified issues
- Technical details (CMS type, load time, security status)

## Usage

### Enrich Existing Leads

```bash
cd /home/runner/work/leadsflow/leadsflow
pnpm enrich:website
```

This command will:
1. Analyze up to 50 leads per run
2. Prioritize high/medium priority leads
3. Skip leads already analyzed
4. Generate pain points for leads without websites
5. Perform deep analysis on real websites

### What Gets Analyzed

- **Leads with websites** (not yet analyzed): Deep analysis with Playwright
- **Leads without websites**: Generate generic pain points
- **Leads with platform URLs**: Generate platform-specific pain points

### Performance

- Rate-limited to 2 concurrent analyses
- ~15 seconds timeout per website
- Graceful error handling (continues on failures)

## Database Schema

New fields added to `leads` table:

```sql
cms_type TEXT                  -- Detected CMS type
has_mobile_friendly INTEGER    -- 0/1 for mobile optimization
has_ssl INTEGER                -- 0/1 for HTTPS
page_load_time INTEGER         -- Load time in milliseconds
pain_points TEXT               -- JSON array of issues
```

## Scoring Impact

Website analysis affects lead scoring:
- **Wix sites**: +12 points (SEO limitations make them good prospects)
- **Slow WordPress**: +8 points (optimization needs)
- **Shopify**: +5 points (high costs, opportunity for custom)
- **Better classified**: Platform sites properly identified

## Call Interface Changes

The call page (`/call`) now displays:

### Pain Points Section
- Appears between "Script d'appel" and "Historique"
- Red/orange gradient background
- Alert icon for visibility
- Bullet list of all pain points
- Technical details footer

### Example Display

```
🔺 Points de Douleur - Arguments de Vente

• ❌ Site non sécurisé (pas de HTTPS) - perte de confiance client
• ⏱️ Site trop lent (4.2s) - perte de clients
• ⚠️ Site Wix - limité pour le SEO, performances moyennes
• 💡 Migration vers site professionnel = +30% visibilité Google

Techno détectée: WIX • Pas de HTTPS • Lent (4.2s)
```

## Technical Details

### CMS Detection Logic

The analyzer checks for:
- **WordPress**: `/wp-content/`, `/wp-includes/`, `wp-json`
- **Wix**: `wix.com`, `_wix_`, `parastorage.com`
- **Shopify**: `cdn.shopify.com`, `Shopify.theme`
- **PrestaShop**: `/modules/ps_`, `prestashop`
- **Squarespace**: `squarespace.com`, `sqsp.com`
- **Webflow**: `webflow.com`, `data-wf-`

### Mobile-Friendly Detection

Checks for:
- Viewport meta tag: `width=device-width`
- Responsive keywords in HTML

### Performance Thresholds

- **Fast**: < 2000ms
- **Acceptable**: 2000-3000ms
- **Slow**: > 3000ms (generates pain point)

## Files Modified/Created

### New Files
- `worker/websiteAnalyzer.ts` - Core analysis logic
- `worker/enrichWebsite.ts` - Enrichment command
- `docs/WEBSITE_ANALYSIS.md` - This file

### Modified Files
- `shared/types.ts` - Added CMSType and new fields
- `shared/db.ts` - Database migrations
- `worker/db.ts` - Insert/update logic
- `worker/scoring.ts` - Enhanced classification and scoring
- `web/src/types/index.ts` - Frontend types
- `web/src/lib/db.ts` - Transform function
- `web/src/components/call/CurrentLeadCard.tsx` - UI display
- `package.json` - Added `enrich:website` command

## Future Improvements

Potential enhancements:
1. **Lighthouse Integration**: Use Google Lighthouse for deeper performance analysis
2. **SEO Analysis**: Check meta tags, structured data, sitemap
3. **Accessibility**: Check WCAG compliance
4. **Competitor Analysis**: Compare to industry standards
5. **Screenshot Capture**: Store screenshots for visual reference
6. **Automatic Re-analysis**: Periodic updates for existing leads
7. **Custom Pain Points**: Allow manual override/editing

## Troubleshooting

### Issue: No pain points displayed
- Check that `pnpm enrich:website` has been run
- Verify database has the new columns
- Check browser console for JSON parse errors

### Issue: Analysis fails
- Ensure Playwright browsers are installed: `npx playwright install`
- Check network connectivity
- Verify timeout is sufficient (default: 15s)

### Issue: Too slow
- Reduce concurrent limit in `enrichWebsite.ts` (default: 2)
- Increase timeout for slow sites
- Run during off-hours

## Security Considerations

- Playwright runs in sandboxed browser
- No credentials or sensitive data transmitted
- Rate-limited to avoid overwhelming targets
- Graceful handling of errors and timeouts
- No data stored from analyzed websites (only metadata)
