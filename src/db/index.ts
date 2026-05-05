import * as SQLite from 'expo-sqlite';

import {
  BASE_TABLES,
  MATCHES_EXTRA_COLUMNS,
  SCHEMA_VERSION,
} from './schema';

const DB_NAME = 'meu-torneio.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      try {
        await migrate(db);
      } catch (err) {
        console.error('[db] migration failed:', err);
        throw err;
      }
      return db;
    });
  }
  return dbPromise;
}

/**
 * Idempotent migration:
 *   1. Ensure base v1 tables exist (CREATE IF NOT EXISTS, always safe).
 *   2. Use PRAGMA table_info to add only the columns that are missing.
 *   3. Bump user_version to current SCHEMA_VERSION.
 *
 * This converges from any starting state — including DBs left in a partially
 * migrated state by an older buggy migration.
 */
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  // Step 1: base tables
  for (const stmt of BASE_TABLES) {
    await db.execAsync(stmt);
  }

  // Step 2: extra columns on matches
  const existing = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(matches);'
  );
  const have = new Set(existing.map((c) => c.name));
  for (const [colName, alterSql] of Object.entries(MATCHES_EXTRA_COLUMNS)) {
    if (have.has(colName)) continue;
    try {
      await db.execAsync(alterSql);
    } catch (err) {
      console.error(`[db] failed to add column ${colName}:`, err);
      throw err;
    }
  }

  // Step 3: ensure existing rows have a non-null `stage` value (defensive
  // against older inserts that didn't set it).
  await db.execAsync(
    "UPDATE matches SET stage = 'main' WHERE stage IS NULL;"
  );

  // Step 4: bump user_version
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

/**
 * Test-only: clear the cached singleton so the next getDatabase() call opens
 * a fresh handle. Useful in tests.
 */
export function _resetDatabaseSingleton(): void {
  dbPromise = null;
}
