#!/usr/bin/env tsx
/**
 * Database Migration CLI
 * 
 * Manage database migrations from the command line
 * 
 * Usage:
 *   tsx shared/migrate.ts status    - Show migration status
 *   tsx shared/migrate.ts up        - Run pending migrations
 *   tsx shared/migrate.ts rollback  - Rollback last migration (use with caution!)
 */

import { getDb, closeDb } from './db';
import {
  getMigrationStatus,
  runMigrations,
  rollbackLastMigration,
} from './migrations';

const command = process.argv[2];

async function main() {
  const db = getDb();
  
  try {
    switch (command) {
      case 'status': {
        const status = getMigrationStatus(db);
        console.log('\n📊 Migration Status\n');
        console.log(`Total migrations: ${status.total}`);
        console.log(`Applied: ${status.applied}`);
        console.log(`Pending: ${status.pending}\n`);
        
        if (status.appliedMigrations.length > 0) {
          console.log('✓ Applied migrations:');
          status.appliedMigrations.forEach(m => {
            console.log(`  ${m.id}. ${m.name} (${m.applied_at})`);
          });
          console.log('');
        }
        
        if (status.pendingMigrations.length > 0) {
          console.log('⏳ Pending migrations:');
          status.pendingMigrations.forEach(m => {
            console.log(`  ${m.id}. ${m.name} - ${m.description}`);
          });
          console.log('');
        }
        break;
      }
      
      case 'up': {
        console.log('\n🚀 Running migrations...\n');
        runMigrations(db);
        console.log('\n✓ Done\n');
        break;
      }
      
      case 'rollback': {
        console.log('\n⚠️  Rolling back last migration...\n');
        console.log('This will undo the last applied migration.');
        console.log('Make sure you have a backup before proceeding!\n');
        
        // In production, you might want to add a confirmation prompt here
        rollbackLastMigration(db);
        console.log('\n✓ Done\n');
        break;
      }
      
      default: {
        console.log(`
Database Migration CLI

Usage:
  tsx shared/migrate.ts <command>

Commands:
  status     Show migration status
  up         Run pending migrations
  rollback   Rollback last migration (CAUTION!)

Examples:
  tsx shared/migrate.ts status
  tsx shared/migrate.ts up
        `);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
