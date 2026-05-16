Read [](file:///home/sycatle/Workspace/leads-finder/shared/db.ts)

Read [](file:///home/sycatle/Workspace/leads-finder/shared/migrations.ts#1-1), lines 1 to 150

Read [](file:///home/sycatle/Workspace/leads-finder/shared/types.ts#1-1), lines 1 to 150

Read [](file:///home/sycatle/Workspace/leads-finder/web/src/lib/db.ts#1-1), lines 1 to 200

Read [](file:///home/sycatle/Workspace/leads-finder/shared/migrations.ts#150-150), lines 150 to 357

Read [](file:///home/sycatle/Workspace/leads-finder/shared/types.ts#150-150), lines 150 to 189

Read [](file:///home/sycatle/Workspace/leads-finder/worker/db.ts#1-1), lines 1 to 100

Read [](file:///home/sycatle/Workspace/leads-finder/web/src/types/index.ts#1-1), lines 1 to 100

Read [](file:///home/sycatle/Workspace/leads-finder/worker/db.ts#100-100), lines 100 to 200

Read [](file:///home/sycatle/Workspace/leads-finder/web/src/lib/db.ts#200-200), lines 200 to 400

Read [](file:///home/sycatle/Workspace/leads-finder/web/src/types/index.ts#100-100), lines 100 to 200

Après analyse approfondie de ton architecture de données, voici mes observations et recommandations :

---

## 🟢 **Points forts actuels**

1. **Système de migrations bien pensé** - Versionnement, rollback, tracking dans `migrations` table
2. **WAL mode SQLite** - Excellente perf pour lecture/écriture concurrente
3. **Upsert intelligent** - Préserve les données commerciales lors des mises à jour
4. **Validation ORDER BY** - Protection contre l'injection SQL avec whitelist

---

## 🔴 **Points d'amélioration identifiés**

### 1. **Duplication de code DB entre worker et web**

Tu as deux fichiers db.ts avec du code quasi-identique :
- db.ts - Connexion + migrations
- db.ts - Connexion dupliquée + 1300+ lignes de queries

**Recommandation :** Centraliser toutes les queries dans shared et importer des deux côtés.

```
shared/
  db.ts          → Connexion unique
  queries/
    leads.ts     → findLeads, countLeads, etc.
    sessions.ts  → Sessions CRUD
    stats.ts     → Requêtes de stats
```

---

### 2. **Transformation DbLead → Lead dispersée**

La fonction `transformDbLead()` qui convertit les `0/1` SQLite en `boolean` est dans db.ts. Mais tu dois l'appeler manuellement partout.

**Recommandation :** Créer un layer de repository qui fait la transformation automatiquement :

```typescript
// shared/repositories/leadRepository.ts
export function findLeads(filters): Lead[] {
  const rows = findLeadsRaw(filters);
  return rows.map(transformDbLead);
}
```

---

### 3. **Pas de connexion pool / lazy loading**

Actuellement, une seule connexion globale. Si le web et worker tournent en même temps, ils créent chacun leur instance séparée.

**Recommandation :** C'est OK pour SQLite car le WAL gère les accès concurrents, mais documente cette contrainte. Si tu migres vers PostgreSQL plus tard, il faudra un pool.

---

### 4. **Index manquants pour les requêtes fréquentes**

Tu as des index sur `status`, `city`, `priority`, `next_followup_at`, mais pas sur :
- `niche` (filtrage très fréquent)
- `call_status` (sessions d'appels)
- `score` (tri par priorité)
- `created_at` (pagination)

**Recommandation :** Ajouter une migration :

```sql
CREATE INDEX IF NOT EXISTS idx_leads_niche ON leads(niche);
CREATE INDEX IF NOT EXISTS idx_leads_call_status ON leads(call_status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
```

---

### 5. **Pas de soft-delete**

Les leads supprimés sont perdus définitivement.

**Recommandation :** Ajouter `deleted_at TEXT DEFAULT NULL` et filtrer avec `WHERE deleted_at IS NULL`. Permet de récupérer des erreurs et d'avoir un historique.

---

### 6. **`pain_points` stocké en JSON string**

C'est correct pour SQLite, mais la sérialisation/désérialisation est manuelle.

**Recommandation :** Créer une table `lead_pain_points` normalisée :

```sql
CREATE TABLE lead_pain_points (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL,
  pain_point TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

Cela permet de filtrer les leads par pain_point spécifique.

---

### 7. **Historique des leads non normalisé**

`lead_history.type` a des valeurs mélangées (`call`, `email`, `note`, `status_change`, `followup_set`). Tu pourrais avoir des tables séparées pour un meilleur reporting :

```
lead_calls       → call_status, duration, outcome
lead_emails      → email_status, subject, opened_at
lead_notes       → note text
lead_status_log  → old_status, new_status
```

---

### 8. **Pas de backup automatique**

**Recommandation :** Ajouter un script de backup dans le worker :

```bash
# Dans ecosystem.config.cjs ou cron
sqlite3 data/leads.db ".backup data/backups/leads_$(date +%Y%m%d).db"
```

---

### 9. **Dates en TEXT au lieu de REAL (timestamp Unix)**

Tu stockes les dates en `TEXT` format ISO. C'est lisible mais moins performant pour les comparaisons.

**Recommandation :** Garder TEXT pour la lisibilité, mais s'assurer d'utiliser des index et des comparaisons cohérentes (`datetime('now')` partout).

---

### 10. **Compteurs dénormalisés absents**

Tu recalcules `COUNT(*)` à chaque requête de stats. Pour de gros volumes, ça ralentit.

**Recommandation :** Ajouter une table `stats_cache` ou des triggers :

```sql
CREATE TABLE stats_daily (
  date TEXT PRIMARY KEY,
  calls_count INTEGER,
  contacts_count INTEGER,
  leads_created INTEGER
);

-- Trigger on lead_history insert to update counts
```