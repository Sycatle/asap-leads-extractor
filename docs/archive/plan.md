# Projet express: 100 leads "call-ready" (niche + région FR)

Objectif: générer un **CSV** de **100 entreprises prêtes à appeler** (téléphone + enrichissement SIREN/dirigeant), en mode MVP rapide.

---

## 0) Principes

* **Source**: Import CSV scraper (Apify/Outscraper) — pas d'API Places au MVP
* **Enrichissement**: Pappers uniquement (SIREN + dirigeant en 1 call)
* **Qualité**: collecte 200+ → dédupe → garde 100
* **Livrable**: 1 fichier `leads.csv`

---

## 1) Stack

### Runtime
* Node.js 20+ (TypeScript) ou Python 3.11+

### Libs minimalistes
* HTTP: `undici` ou `axios`
* CSV: `csv-parse`, `csv-stringify`
* Rate-limit: `p-limit`

### Env
```
PAPPERS_API_KEY=
```

---

## 2) Architecture (3 fichiers max)

```
leads-finder/
  package.json
  .env
  config.json
  /src
    collect.ts      # Import CSV + normalisation + dédup
    enrich.ts       # Pappers (SIREN + dirigeant)
    export.ts       # CSV final
  /data
    raw/            # CSV importé
    leads.csv       # Output final
```

---

## 3) Modèle de données

```typescript
interface Lead {
  // Collecte
  name: string;
  phone: string;           // Obligatoire
  address: string;
  city: string;
  postal_code: string;
  website?: string;
  maps_url: string;
  rating?: number;
  reviews_count?: number;
  
  // Enrichissement (Pappers)
  siren?: string;
  siret?: string;
  legal_name?: string;
  dirigeant?: string;
  
  // Priorisation
  priority: 'high' | 'medium' | 'low';
}
```

---

## 4) Config simple

```json
{
  "input_csv": "data/raw/export.csv",
  "target": 100,
  "allowed_departments": ["72", "49", "53"],
  "exclude_keywords": ["Carrefour", "McDonald's", "Leclerc"]
}
```

---

## 5) Pipeline (3 étapes)

### A. Collecte (`collect.ts`)
1. Lire CSV scraper
2. Mapper colonnes → Lead
3. Normaliser téléphones (format FR)
4. Dédupliquer par `phone`
5. Filtrer: `phone` obligatoire + département autorisé

### B. Enrichissement (`enrich.ts`)
1. Pour chaque lead: recherche Pappers (nom + ville)
2. Si match: récupérer SIREN + dirigeant
3. Rate limit: 2 req/sec, backoff sur 429

### C. Export (`export.ts`)
1. Trier par priorité:
   - `high`: pas de website
   - `medium`: website présent
   - `low`: chaîne détectée
2. Garder les 100 premiers
3. Écrire `leads.csv`

---

## 6) CLI

```bash
# Run complet
pnpm start

# Ou étape par étape
pnpm collect
pnpm enrich
pnpm export
```

---

## 7) Livrable unique

**`data/leads.csv`** avec colonnes:
```
name,phone,address,city,postal_code,website,maps_url,siren,dirigeant,priority
```

Console log à la fin:
```
✓ Importés: 234
✓ Après dédup: 189  
✓ Enrichis SIREN: 156
✓ Exportés: 100
```

---

## 8) SPRINTS DÉTAILLÉS (TypeScript)

---

### SPRINT 0 — Setup projet (10 min)

#### 0.1 Initialiser le projet
```bash
mkdir leads-finder && cd leads-finder
pnpm init
pnpm add typescript tsx @types/node -D
pnpm add csv-parse csv-stringify undici p-limit dotenv
npx tsc --init
```

#### 0.2 Fichiers à créer
```
leads-finder/
├── package.json
├── tsconfig.json
├── .env
├── .gitignore
├── config.json
├── src/
│   ├── types.ts
│   ├── collect.ts
│   ├── enrich.ts
│   ├── export.ts
│   └── index.ts
└── data/
    └── raw/
        └── .gitkeep
```

#### 0.3 package.json scripts
```json
{
  "scripts": {
    "start": "tsx src/index.ts",
    "collect": "tsx src/collect.ts",
    "enrich": "tsx src/enrich.ts",
    "export": "tsx src/export.ts"
  }
}
```

#### 0.4 tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

#### 0.5 .env
```
PAPPERS_API_KEY=votre_cle_ici
```

#### 0.6 config.json
```json
{
  "input_csv": "data/raw/export.csv",
  "target": 100,
  "allowed_departments": ["72", "49", "53", "44", "85"],
  "exclude_keywords": ["Carrefour", "McDonald's", "Leclerc", "Auchan", "Intermarché"]
}
```

**✓ Checkpoint**: `pnpm start` doit compiler sans erreur

---

### SPRINT 1 — Types & Config (10 min)

#### 1.1 Créer `src/types.ts`
```typescript
export interface RawLead {
  name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  website?: string;
  maps_url: string;
  rating?: number;
  reviews_count?: number;
}

export interface EnrichedLead extends RawLead {
  siren?: string;
  siret?: string;
  legal_name?: string;
  dirigeant?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Config {
  input_csv: string;
  target: number;
  allowed_departments: string[];
  exclude_keywords: string[];
}

export interface PappersResult {
  siren: string;
  siret: string;
  nom_entreprise: string;
  representants?: Array<{
    nom: string;
    prenom: string;
    qualite: string;
  }>;
}
```

#### 1.2 Créer `src/config.ts`
```typescript
import { readFileSync } from 'fs';
import { Config } from './types.js';

export function loadConfig(path = 'config.json'): Config {
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as Config;
}
```

**✓ Checkpoint**: Types définis, config chargeable

---

### SPRINT 2 — Collecte & Import CSV (25 min)

#### 2.1 Créer `src/collect.ts`

```typescript
import { createReadStream, writeFileSync } from 'fs';
import { parse } from 'csv-parse';
import { loadConfig } from './config.js';
import { RawLead, Config } from './types.js';

// Mapping colonnes CSV scraper → RawLead
function mapRow(row: Record<string, string>): RawLead | null {
  const phone = normalizePhone(row.phone || row.telephone || row.Phone || '');
  if (!phone) return null; // Skip si pas de téléphone
  
  return {
    name: row.name || row.title || row.nom || '',
    phone,
    address: row.address || row.adresse || '',
    city: row.city || row.ville || '',
    postal_code: extractPostalCode(row.postal_code || row.address || ''),
    website: row.website || row.site || undefined,
    maps_url: row.url || row.maps_url || row.link || '',
    rating: parseFloat(row.rating || row.note || '0') || undefined,
    reviews_count: parseInt(row.reviews || row.reviews_count || '0') || undefined,
  };
}

// Normalise téléphone FR (format: 0612345678)
function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s.\-()]/g, '');
  // Format FR: commence par 0 ou +33
  if (cleaned.startsWith('+33')) {
    return '0' + cleaned.slice(3);
  }
  if (cleaned.startsWith('33') && cleaned.length === 11) {
    return '0' + cleaned.slice(2);
  }
  if (/^0[1-9]\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  return ''; // Invalide
}

// Extrait code postal de l'adresse
function extractPostalCode(address: string): string {
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : '';
}

// Filtre par département autorisé
function isAllowedDepartment(postalCode: string, config: Config): boolean {
  if (!postalCode || config.allowed_departments.length === 0) return true;
  const dept = postalCode.substring(0, 2);
  return config.allowed_departments.includes(dept);
}

// Filtre chaînes exclues
function isExcludedChain(name: string, config: Config): boolean {
  const lower = name.toLowerCase();
  return config.exclude_keywords.some(kw => lower.includes(kw.toLowerCase()));
}

// Déduplication par téléphone
function dedupeByPhone(leads: RawLead[]): RawLead[] {
  const seen = new Set<string>();
  return leads.filter(lead => {
    if (seen.has(lead.phone)) return false;
    seen.add(lead.phone);
    return true;
  });
}

// Main
export async function collect(): Promise<RawLead[]> {
  const config = loadConfig();
  const leads: RawLead[] = [];
  
  return new Promise((resolve, reject) => {
    createReadStream(config.input_csv)
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .on('data', (row: Record<string, string>) => {
        const lead = mapRow(row);
        if (lead && 
            isAllowedDepartment(lead.postal_code, config) &&
            !isExcludedChain(lead.name, config)) {
          leads.push(lead);
        }
      })
      .on('end', () => {
        const deduped = dedupeByPhone(leads);
        console.log(`✓ Importés: ${leads.length}`);
        console.log(`✓ Après dédup: ${deduped.length}`);
        
        // Sauvegarde intermédiaire
        writeFileSync('data/leads_raw.json', JSON.stringify(deduped, null, 2));
        resolve(deduped);
      })
      .on('error', reject);
  });
}

// Run standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  collect().catch(console.error);
}
```

**✓ Checkpoint**: `pnpm collect` importe le CSV et produit `data/leads_raw.json`

---

### SPRINT 3 — Enrichissement Pappers (30 min)

#### 3.1 Créer `src/enrich.ts`

```typescript
import { readFileSync, writeFileSync } from 'fs';
import { request } from 'undici';
import pLimit from 'p-limit';
import { RawLead, EnrichedLead, PappersResult } from './types.js';
import 'dotenv/config';

const PAPPERS_API_KEY = process.env.PAPPERS_API_KEY!;
const PAPPERS_BASE_URL = 'https://api.pappers.fr/v2';

// Rate limit: 2 requêtes/seconde
const limit = pLimit(2);

// Recherche entreprise par nom + ville
async function searchPappers(name: string, city: string): Promise<PappersResult | null> {
  const query = encodeURIComponent(`${name} ${city}`);
  const url = `${PAPPERS_BASE_URL}/recherche?api_token=${PAPPERS_API_KEY}&q=${query}&par_page=1`;
  
  try {
    const { statusCode, body } = await request(url);
    
    if (statusCode === 429) {
      // Rate limited, attendre et retry
      await sleep(2000);
      return searchPappers(name, city);
    }
    
    if (statusCode !== 200) {
      return null;
    }
    
    const data = await body.json() as { resultats: PappersResult[] };
    return data.resultats?.[0] || null;
  } catch (error) {
    console.error(`Erreur Pappers pour ${name}:`, error);
    return null;
  }
}

// Récupérer dirigeant principal
function extractDirigeant(result: PappersResult): string | undefined {
  const rep = result.representants?.find(r => 
    r.qualite?.toLowerCase().includes('gérant') ||
    r.qualite?.toLowerCase().includes('président') ||
    r.qualite?.toLowerCase().includes('directeur')
  ) || result.representants?.[0];
  
  if (rep) {
    return `${rep.prenom} ${rep.nom}`.trim();
  }
  return undefined;
}

// Calcul priorité
function computePriority(lead: RawLead): 'high' | 'medium' | 'low' {
  // High: pas de site web = opportunité
  if (!lead.website) return 'high';
  // Low: site existe et bonnes reviews
  if (lead.rating && lead.rating >= 4.5 && lead.reviews_count && lead.reviews_count > 50) {
    return 'low';
  }
  return 'medium';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main
export async function enrich(): Promise<EnrichedLead[]> {
  const raw: RawLead[] = JSON.parse(readFileSync('data/leads_raw.json', 'utf-8'));
  const enriched: EnrichedLead[] = [];
  
  let enrichedCount = 0;
  let current = 0;
  
  const tasks = raw.map(lead => limit(async () => {
    current++;
    process.stdout.write(`\rEnrichissement: ${current}/${raw.length}`);
    
    const result = await searchPappers(lead.name, lead.city);
    
    const enrichedLead: EnrichedLead = {
      ...lead,
      priority: computePriority(lead),
    };
    
    if (result) {
      enrichedLead.siren = result.siren;
      enrichedLead.siret = result.siret;
      enrichedLead.legal_name = result.nom_entreprise;
      enrichedLead.dirigeant = extractDirigeant(result);
      enrichedCount++;
    }
    
    enriched.push(enrichedLead);
    
    // Pause entre requêtes
    await sleep(500);
  }));
  
  await Promise.all(tasks);
  
  console.log(`\n✓ Enrichis SIREN: ${enrichedCount}/${raw.length}`);
  
  // Sauvegarde
  writeFileSync('data/leads_enriched.json', JSON.stringify(enriched, null, 2));
  return enriched;
}

// Run standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  enrich().catch(console.error);
}
```

**✓ Checkpoint**: `pnpm enrich` enrichit les leads et produit `data/leads_enriched.json`

---

### SPRINT 4 — Export CSV final (15 min)

#### 4.1 Créer `src/export.ts`

```typescript
import { readFileSync, writeFileSync } from 'fs';
import { stringify } from 'csv-stringify/sync';
import { EnrichedLead } from './types.js';
import { loadConfig } from './config.js';

// Tri par priorité
function sortByPriority(leads: EnrichedLead[]): EnrichedLead[] {
  const order = { high: 0, medium: 1, low: 2 };
  return [...leads].sort((a, b) => order[a.priority] - order[b.priority]);
}

// Main
export function exportCSV(): void {
  const config = loadConfig();
  const leads: EnrichedLead[] = JSON.parse(
    readFileSync('data/leads_enriched.json', 'utf-8')
  );
  
  // Trier et limiter
  const sorted = sortByPriority(leads);
  const final = sorted.slice(0, config.target);
  
  // Colonnes CSV
  const columns = [
    'name',
    'phone',
    'city',
    'postal_code',
    'address',
    'website',
    'maps_url',
    'rating',
    'reviews_count',
    'siren',
    'legal_name',
    'dirigeant',
    'priority',
  ];
  
  const csv = stringify(final, {
    header: true,
    columns,
  });
  
  writeFileSync('data/leads.csv', csv);
  
  // Stats finales
  const stats = {
    total_imported: leads.length,
    with_siren: leads.filter(l => l.siren).length,
    with_dirigeant: leads.filter(l => l.dirigeant).length,
    exported: final.length,
    by_priority: {
      high: final.filter(l => l.priority === 'high').length,
      medium: final.filter(l => l.priority === 'medium').length,
      low: final.filter(l => l.priority === 'low').length,
    },
  };
  
  console.log('\n========== RAPPORT ==========');
  console.log(`✓ Total importés: ${stats.total_imported}`);
  console.log(`✓ Avec SIREN: ${stats.with_siren}`);
  console.log(`✓ Avec dirigeant: ${stats.with_dirigeant}`);
  console.log(`✓ Exportés: ${stats.exported}`);
  console.log(`  → High priority: ${stats.by_priority.high}`);
  console.log(`  → Medium priority: ${stats.by_priority.medium}`);
  console.log(`  → Low priority: ${stats.by_priority.low}`);
  console.log(`\n📁 Fichier: data/leads.csv`);
}

// Run standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  exportCSV();
}
```

**✓ Checkpoint**: `pnpm export` produit `data/leads.csv`

---

### SPRINT 5 — Orchestration (5 min)

#### 5.1 Créer `src/index.ts`

```typescript
import { collect } from './collect.js';
import { enrich } from './enrich.js';
import { exportCSV } from './export.js';

async function main() {
  console.log('🚀 Leads Finder - Démarrage\n');
  
  const startTime = Date.now();
  
  // Étape 1: Collecte
  console.log('📥 COLLECTE...');
  await collect();
  console.log('');
  
  // Étape 2: Enrichissement
  console.log('🔍 ENRICHISSEMENT...');
  await enrich();
  console.log('');
  
  // Étape 3: Export
  console.log('📤 EXPORT...');
  exportCSV();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Terminé en ${duration}s`);
}

main().catch(console.error);
```

**✓ Checkpoint**: `pnpm start` exécute le pipeline complet

---

## 9) Checklist finale

```
[ ] CSV scraper placé dans data/raw/export.csv
[ ] .env configuré avec PAPPERS_API_KEY
[ ] config.json adapté (départements, mots-clés exclus)
[ ] pnpm install exécuté
[ ] pnpm start → data/leads.csv généré avec 100 leads
```

---

## 10) Évolutions post-MVP

- [ ] Google Places API (collecte directe)
- [ ] Dropcontact (enrichissement email)
- [ ] CLI avec commander + options
- [ ] SQLite pour reprise sur erreur
- [ ] Tests unitaires

Fin. Ship first, refactor later.
