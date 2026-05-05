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
 *   1. Ensure base tables exist (CREATE IF NOT EXISTS, always safe).
 *   2. Use PRAGMA table_info to add only the columns that are missing.
 *   3. v3 backfill: ensure every tournament has a `phases` row matching its
 *      legacy `type`, and every existing match links to the correct phase.
 *   4. Bump user_version to current SCHEMA_VERSION.
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

  // Step 3b (v3): backfill phases for tournaments that don't have any yet,
  // then link existing matches.phase_id by mapping stage → phase ordinal.
  await backfillPhases(db);

  // Step 4: bump user_version
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

/**
 * For each tournament that has zero phases, create them based on the legacy
 * `type` field, then update its matches' phase_id by stage.
 *
 *   single_elimination → 1 phase: format=single_elimination, ordinal=0
 *   round_robin        → 1 phase: format=round_robin,        ordinal=0
 *   groups_knockout    → 2 phases: ord=0 round_robin (groupCount=2, q=4),
 *                                  ord=1 single_elimination
 *
 * Stage→phase mapping for existing match rows:
 *   stage='main'     → ordinal 0 (single_elim or round_robin tournaments)
 *   stage='group'    → ordinal 0 (groups_knockout)
 *   stage='knockout' → ordinal 1 (groups_knockout)
 */
async function backfillPhases(db: SQLite.SQLiteDatabase): Promise<void> {
  const tournaments = await db.getAllAsync<{ id: number; type: string }>(
    'SELECT id, type FROM tournaments;'
  );
  for (const t of tournaments) {
    const phaseCount = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM phases WHERE tournament_id = ?;',
      [t.id]
    );
    if ((phaseCount?.c ?? 0) > 0) continue;

    const phases = defaultPhasesForType(t.type);
    const ordinalToPhaseId = new Map<number, number>();
    for (const p of phases) {
      const r = await db.runAsync(
        `INSERT INTO phases
          (tournament_id, ordinal, name, format, legs, group_count, qualifiers, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          t.id,
          p.ordinal,
          p.name,
          p.format,
          p.legs,
          p.groupCount,
          p.qualifiers,
          'pending',
        ]
      );
      ordinalToPhaseId.set(p.ordinal, r.lastInsertRowId);
    }

    // Map stage → ordinal and update the matches.
    const mapping: Array<{ stage: string; ordinal: number }> =
      t.type === 'groups_knockout'
        ? [
            { stage: 'group', ordinal: 0 },
            { stage: 'knockout', ordinal: 1 },
          ]
        : [{ stage: 'main', ordinal: 0 }];

    for (const m of mapping) {
      const phaseId = ordinalToPhaseId.get(m.ordinal);
      if (!phaseId) continue;
      await db.runAsync(
        `UPDATE matches SET phase_id = ?
         WHERE tournament_id = ? AND stage = ? AND phase_id IS NULL;`,
        [phaseId, t.id, m.stage]
      );
    }
  }
}

interface DefaultPhase {
  ordinal: number;
  name: string;
  format: 'single_elimination' | 'round_robin';
  legs: 1 | 2;
  groupCount: number;
  qualifiers: number | null;
}

/**
 * Default phase shape for each legacy tournament type. Exported for use by
 * tournament creation (so a freshly created tournament gets phases too).
 */
export function defaultPhasesForType(type: string): DefaultPhase[] {
  switch (type) {
    case 'round_robin':
      return [
        {
          ordinal: 0,
          name: 'Liga',
          format: 'round_robin',
          legs: 1,
          groupCount: 1,
          qualifiers: null,
        },
      ];
    case 'groups_knockout':
      return [
        {
          ordinal: 0,
          name: 'Grupos',
          format: 'round_robin',
          legs: 1,
          groupCount: 2,
          qualifiers: 4,
        },
        {
          ordinal: 1,
          name: 'Mata-mata',
          format: 'single_elimination',
          legs: 1,
          groupCount: 1,
          qualifiers: null,
        },
      ];
    case 'single_elimination':
    default:
      return [
        {
          ordinal: 0,
          name: 'Mata-mata',
          format: 'single_elimination',
          legs: 1,
          groupCount: 1,
          qualifiers: null,
        },
      ];
  }
}

/**
 * Test-only: clear the cached singleton so the next getDatabase() call opens
 * a fresh handle. Useful in tests.
 */
export function _resetDatabaseSingleton(): void {
  dbPromise = null;
}
