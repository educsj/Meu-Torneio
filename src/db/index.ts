import * as SQLite from 'expo-sqlite';

import { MIGRATIONS, SCHEMA_VERSION } from './schema';

const DB_NAME = 'meu-torneio.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;'
  );
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  for (let v = current; v < SCHEMA_VERSION; v++) {
    const statements = MIGRATIONS[v];
    if (!statements) continue;
    for (const stmt of statements) {
      await db.execAsync(stmt);
    }
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}
