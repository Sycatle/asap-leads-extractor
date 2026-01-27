# Architecture Base de Données

## Vue d'ensemble

Leads Finder utilise **SQLite** avec le mode **WAL** (Write-Ahead Logging) pour permettre des lectures/écritures concurrentes entre le worker et le web.

```
data/
  leads.db          → Base de données principale
  backups/          → Backups automatiques (rotation 7 jours)
```

## Schéma des tables

### Tables principales

#### `leads`
Table centrale contenant toutes les informations sur les leads.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Clé primaire auto-incrémentée |
| phone | TEXT | Numéro de téléphone (UNIQUE) |
| phone_type | TEXT | 'pro', 'perso', 'unknown' |
| name | TEXT | Nom de l'entreprise |
| address | TEXT | Adresse complète |
| city | TEXT | Ville |
| postal_code | TEXT | Code postal |
| website | TEXT | URL du site web |
| website_status | TEXT | 'none', 'old', 'platform', 'modern' |
| maps_url | TEXT | URL Google Maps |
| rating | REAL | Note Google (0-5) |
| reviews_count | INTEGER | Nombre d'avis |
| niche | TEXT | Secteur d'activité |
| image_url | TEXT | Photo Google Maps |
| source | TEXT | 'gmb', 'annuaire', 'scraping', 'import', 'manual' |
| siren | TEXT | Numéro SIREN (Pappers) |
| siret | TEXT | Numéro SIRET (Pappers) |
| legal_name | TEXT | Raison sociale (Pappers) |
| dirigeant | TEXT | Nom du dirigeant (Pappers) |
| priority | TEXT | 'high', 'medium', 'low' |
| score | INTEGER | Score de priorité (0-100) |
| status | TEXT | Statut commercial (voir ci-dessous) |
| call_status | TEXT | Statut d'appel (voir ci-dessous) |
| email_status | TEXT | Statut email |
| notes | TEXT | Notes libres |
| attempts_count | INTEGER | Nombre de tentatives d'appel |
| opt_out | INTEGER | 0/1 - Ne plus contacter |
| deleted_at | TEXT | Soft-delete timestamp |
| created_at | TEXT | Date de création |
| updated_at | TEXT | Dernière modification |

**Index :** phone, status, city, priority, next_followup_at, niche, call_status, score, created_at, deleted_at

#### `call_sessions`
Sessions d'appels (campagnes).

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Clé primaire |
| started_at | TEXT | Début de session |
| ended_at | TEXT | Fin de session |
| total_calls | INTEGER | Appels effectués |
| total_reached | INTEGER | Contacts réussis |
| total_voicemail | INTEGER | Messageries |
| total_scheduled | INTEGER | Relances planifiées |
| notes | TEXT | Notes de session |

### Tables normalisées (v2.0)

#### `lead_pain_points`
Points de douleur identifiés pour chaque lead (normalisé depuis JSON).

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Clé primaire |
| lead_id | INTEGER | FK vers leads |
| pain_point | TEXT | Point de douleur |
| detected_at | TEXT | Date de détection |

**Index :** lead_id, pain_point

#### `lead_calls`
Historique détaillé des appels.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Clé primaire |
| lead_id | INTEGER | FK vers leads |
| session_id | INTEGER | FK vers call_sessions |
| outcome | TEXT | Résultat de l'appel |
| duration_seconds | INTEGER | Durée en secondes |
| note | TEXT | Note de l'appel |
| called_at | TEXT | Date/heure de l'appel |

**Index :** lead_id, session_id, called_at, outcome

#### `lead_notes`
Notes associées aux leads.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Clé primaire |
| lead_id | INTEGER | FK vers leads |
| content | TEXT | Contenu de la note |
| author | TEXT | Auteur ('user', 'system') |
| created_at | TEXT | Date de création |

**Index :** lead_id, created_at

#### `lead_status_log`
Journal des changements de statut (funnel).

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Clé primaire |
| lead_id | INTEGER | FK vers leads |
| from_status | TEXT | Ancien statut |
| to_status | TEXT | Nouveau statut |
| reason | TEXT | Raison du changement |
| changed_at | TEXT | Date du changement |

**Index :** lead_id, changed_at, to_status

#### `stats_daily`
Cache des statistiques quotidiennes.

| Colonne | Type | Description |
|---------|------|-------------|
| date | TEXT | Date (PK) |
| leads_created | INTEGER | Leads créés ce jour |
| leads_contacted | INTEGER | Leads contactés |
| leads_qualified | INTEGER | Leads qualifiés |
| leads_converted | INTEGER | Leads convertis |
| leads_lost | INTEGER | Leads perdus |
| calls_made | INTEGER | Appels effectués |
| calls_reached | INTEGER | Contacts réussis |
| calls_voicemail | INTEGER | Messageries |
| followups_set | INTEGER | Relances planifiées |
| avg_score | REAL | Score moyen |
| updated_at | TEXT | Dernière mise à jour |

### Tables legacy

#### `lead_history`
⚠️ **Table legacy** - Les données sont maintenant dupliquées dans les tables normalisées ci-dessus.
Conservée pour compatibilité ascendante.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Clé primaire |
| lead_id | INTEGER | FK vers leads |
| type | TEXT | 'call', 'email', 'note', 'status_change', 'followup_set' |
| old_value | TEXT | Ancienne valeur |
| new_value | TEXT | Nouvelle valeur |
| note | TEXT | Note associée |
| duration_seconds | INTEGER | Durée (pour calls) |
| created_at | TEXT | Date de l'événement |

#### `migrations`
Suivi des migrations appliquées.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | ID de migration |
| name | TEXT | Nom de la migration |
| description | TEXT | Description |
| applied_at | TEXT | Date d'application |

## Statuts

### Lead Status (Pipeline commercial)
```
nouveau → contacte → qualifie → proposition → converti
                                            ↘ perdu
```

### Call Status
```
non_appele → appele    (conversation OK)
           → rappeler  (demande de rappel)
           → injoignable (pas décroché)
```

## Architecture du code

```
shared/
  db.ts              → Connexion SQLite partagée
  migrations.ts      → Définition des migrations
  types.ts           → Types TypeScript
  queries/
    index.ts         → Point d'entrée unique
    types.ts         → Types des queries
    security.ts      → Utilitaires sécurité SQL
    leads.ts         → CRUD leads
    sessions.ts      → Sessions d'appels
    stats.ts         → Statistiques
    history.ts       → Historique (legacy)
    painPoints.ts    → Pain points normalisés
    calls.ts         → Appels normalisés
    notes.ts         → Notes normalisées
    statusLog.ts     → Journal des statuts
    dailyStats.ts    → Stats quotidiennes cachées

web/src/lib/db.ts    → Wrapper pour Next.js (importe shared/queries)
worker/db.ts         → Opérations spécifiques worker (upsert, scraping)
```

## Soft-delete

Les leads ne sont jamais supprimés définitivement. La colonne `deleted_at` est utilisée :

```sql
-- Toutes les queries filtrent automatiquement :
WHERE deleted_at IS NULL

-- Pour supprimer un lead :
UPDATE leads SET deleted_at = datetime('now') WHERE id = ?

-- Pour restaurer :
UPDATE leads SET deleted_at = NULL WHERE id = ?
```

## Backups

Les backups sont automatiques :
- **Manuel :** `pnpm backup` ou `pnpm backup:rotate`
- **PM2 :** Tous les jours à 2h du matin avec rotation 7 jours

```bash
# Backup simple
./backup.sh

# Backup avec rotation (garder les 7 derniers)
./backup.sh --rotate 7
```

## Migrations

```bash
# Voir le statut
pnpm migrate:status

# Appliquer les migrations
pnpm migrate

# Rollback (ATTENTION)
pnpm migrate:rollback
```

**Règle d'or :** Ne jamais modifier une migration existante, toujours en créer une nouvelle.

## Performance

### Index recommandés (déjà en place)
- `phone` - Lookups par téléphone (upsert)
- `status`, `call_status` - Filtres fréquents
- `city`, `niche` - Filtres géographiques/métier
- `score` - Tri par priorité
- `next_followup_at` - Relances
- `created_at` - Pagination

### Mode WAL
Le mode WAL permet :
- Lectures non-bloquantes pendant les écritures
- Meilleure performance en écriture
- Accès concurrent worker/web

```javascript
db.pragma('journal_mode = WAL');
```

## Requêtes courantes

### Trouver les leads à appeler
```sql
SELECT * FROM leads 
WHERE status = 'nouveau' 
  AND call_status = 'non_appele'
  AND deleted_at IS NULL
ORDER BY score DESC
LIMIT 50;
```

### Statistiques de conversion
```sql
SELECT to_status, COUNT(*) 
FROM lead_status_log 
WHERE changed_at >= datetime('now', '-30 days')
GROUP BY to_status;
```

### Leads par pain point
```sql
SELECT l.* FROM leads l
INNER JOIN lead_pain_points pp ON l.id = pp.lead_id
WHERE pp.pain_point LIKE '%site lent%'
  AND l.deleted_at IS NULL;
```
