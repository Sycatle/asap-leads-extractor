# Database Migrations System

## Overview

This project uses a robust migration system to manage database schema changes. All migrations are tracked in a dedicated `migrations` table, ensuring schema consistency across environments.

## Migration System Features

- **Version Control**: Each migration has a unique ID and timestamp
- **Idempotent**: Migrations can be run multiple times safely
- **Transactional**: Each migration runs in a transaction (all-or-nothing)
- **Trackable**: Migration table tracks which migrations have been applied
- **Rollback Support**: Migrations can define rollback scripts (optional)
- **CLI Tools**: Easy-to-use commands for managing migrations

## Usage

### Check Migration Status

```bash
npm run migrate:status
# or
pnpm migrate:status
```

Shows:
- Total number of migrations
- Applied migrations with timestamps
- Pending migrations

### Run Pending Migrations

```bash
npm run migrate:up
# or
pnpm migrate:up
```

Applies all pending migrations in order. Migrations are run automatically when the app starts, but you can also run them manually.

### Rollback Last Migration

```bash
npm run migrate:rollback
# or
pnpm migrate:rollback
```

⚠️ **CAUTION**: This undoes the last applied migration. Only use if you know what you're doing!

## Creating New Migrations

### 1. Add Migration to `shared/migrations.ts`

Migrations are defined in the `migrations` array in `shared/migrations.ts`. Each migration must have:

- **id**: Unique sequential number (always increment from last migration)
- **name**: Descriptive name (format: `XXX_description_here`)
- **description**: Human-readable description
- **up**: SQL string or function to apply the migration
- **down** (optional): SQL string or function to rollback the migration

### 2. Example: Adding a New Column

```typescript
{
  id: 13,
  name: '013_add_email_to_leads',
  description: 'Add email column to leads table',
  up: "ALTER TABLE leads ADD COLUMN email TEXT",
  down: "ALTER TABLE leads DROP COLUMN email",
}
```

### 3. Example: Complex Migration with Function

```typescript
{
  id: 14,
  name: '014_populate_email_from_notes',
  description: 'Extract emails from notes field',
  up: (db) => {
    // Complex logic here
    const leads = db.prepare('SELECT id, notes FROM leads WHERE email IS NULL').all();
    const updateStmt = db.prepare('UPDATE leads SET email = ? WHERE id = ?');
    
    for (const lead of leads) {
      const emailMatch = lead.notes?.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        updateStmt.run(emailMatch[0], lead.id);
      }
    }
  },
  down: "UPDATE leads SET email = NULL",
}
```

## Migration Workflow

### Development

1. Create migration in `shared/migrations.ts`
2. Run `pnpm migrate:up` to test
3. Verify changes in database
4. Commit migration file

### Production

Migrations run automatically when the app starts via `getDb()` → `initSchema()` → `runMigrations()`.

You can also run manually:
```bash
pnpm migrate:up
```

## Best Practices

### DO ✅

- **Sequential IDs**: Always increment the migration ID
- **Never Modify**: Never change existing migrations once committed
- **Descriptive Names**: Use clear, descriptive migration names
- **Test First**: Test migrations in development before deploying
- **Small Changes**: Keep migrations focused on one change
- **Add Down Scripts**: Provide rollback scripts when possible
- **Backup First**: Always backup production database before running migrations

### DON'T ❌

- **Don't Skip IDs**: Don't create gaps in migration IDs
- **Don't Modify Applied**: Don't modify migrations that have been applied
- **Don't Delete**: Don't delete old migrations from the array
- **Don't Assume Order**: Don't assume table creation order in complex migrations
- **Don't Forget Indexes**: Remember to add indexes for new columns when needed

## Migration Table Schema

```sql
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  applied_at TEXT DEFAULT (datetime('now'))
)
```

## Troubleshooting

### Migration Failed

If a migration fails:

1. Check the error message
2. Fix the migration SQL/code
3. The failed migration won't be marked as applied (due to transaction rollback)
4. Run `pnpm migrate:up` again

### Database Out of Sync

If databases are out of sync between environments:

1. Run `pnpm migrate:status` on both
2. Compare applied migrations
3. Run `pnpm migrate:up` on the behind environment

### Need to Undo Last Migration

```bash
pnpm migrate:rollback
```

Only works if the migration has a `down` script defined.

### Start Fresh (Development Only!)

⚠️ **DANGER**: This deletes all data!

```bash
rm data/leads.db
pnpm migrate:up
```

## Architecture

### Files

- `shared/migrations.ts`: Migration definitions and runner
- `shared/migrate.ts`: CLI tool for managing migrations
- `shared/db.ts`: Database connection and schema initialization

### Flow

```
App Start
  ↓
getDb()
  ↓
initSchema()
  ↓
runMigrations()
  ↓
  1. Create migrations table if not exists
  2. Get list of applied migrations
  3. Find pending migrations
  4. Run each in transaction:
     - Execute migration.up
     - Record in migrations table
     - Commit
  5. Done
```

## Examples

### Check Status
```bash
$ pnpm migrate:status

📊 Migration Status

Total migrations: 12
Applied: 12
Pending: 0

✓ Applied migrations:
  1. 001_initial_schema (2026-01-20 12:00:00)
  2. 002_add_lead_history (2026-01-20 12:00:01)
  ...
```

### Run Migrations
```bash
$ pnpm migrate:up

[Migrations] Checking for pending migrations...
[Migrations] Found 2 pending migration(s)
[Migrations] Running: 013_add_email_to_leads - Add email column
[Migrations] ✓ Applied: 013_add_email_to_leads
[Migrations] Running: 014_add_tags - Add tags support
[Migrations] ✓ Applied: 014_add_tags
[Migrations] ✓ All migrations applied successfully
```

## Migration History

Current migrations in the system:

1. **001_initial_schema**: Create leads table with core fields
2. **002_add_lead_history**: Add history tracking
3. **003_add_call_sessions**: Add call session tracking
4. **004_add_call_scripts**: Add sales scripts
5. **005_add_phone_type**: Add phone type classification
6. **006_add_website_status**: Add website status field
7. **007_add_score**: Add lead scoring
8. **008_add_opening_hours**: Add business hours
9. **009_add_enrichment_flags**: Add booking/SEO flags
10. **010_add_attempts_and_optout**: Add tracking fields
11. **011_add_image_url**: Add Google Maps image
12. **012_add_website_analysis**: Add website analysis fields (CMS, mobile, SSL, performance, pain points)

## Support

For issues or questions about migrations:

1. Check this README
2. Run `pnpm migrate:status` to diagnose
3. Review migration logs in console
4. Check database directly: `sqlite3 data/leads.db "SELECT * FROM migrations;"`
