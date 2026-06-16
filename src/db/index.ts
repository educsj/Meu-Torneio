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
  // Step 0 (v4): if the existing tournaments table still carries the old
  // `CHECK (type IN ...)` constraint, rebuild it without the CHECK so new
  // tournament types can be inserted without yet another migration. Detected
  // by inspecting sqlite_master so this runs at most once per DB.
  await rebuildTournamentsIfStrictCheck(db);

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

  // v5: phases gain a `scoring` column. Existing rows default to 'fifa'
  // (FIFA-style W3/D1/L0) — preserves the behavior of every tournament
  // created before per-phase scoring shipped.
  // v7: phases gain a `third_place` column (0/1 boolean). Existing rows
  // default to 0 — preserves behavior for tournaments created before the
  // 3rd-place feature shipped.
  const phaseCols = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(phases);'
  );
  const phaseHas = new Set(phaseCols.map((c) => c.name));
  if (!phaseHas.has('scoring')) {
    await db.execAsync(
      `ALTER TABLE phases ADD COLUMN scoring TEXT NOT NULL DEFAULT 'fifa';`
    );
  }
  if (!phaseHas.has('third_place')) {
    await db.execAsync(
      `ALTER TABLE phases ADD COLUMN third_place INTEGER NOT NULL DEFAULT 0;`
    );
  }
  // v9: bracket_reset boolean for double_elimination phases. Existing rows
  // default to 0 — preserves the single-grand-final behavior shipped in v8.
  if (!phaseHas.has('bracket_reset')) {
    await db.execAsync(
      `ALTER TABLE phases ADD COLUMN bracket_reset INTEGER NOT NULL DEFAULT 0;`
    );
  }
  // v11: per-phase tiebreaker preset. New phases default to 'fifa'. Existing
  // phases are backfilled to 'conmebol' (= the legacy points→H2H→GD→GF→name
  // order) so already-created tournaments rank exactly as before. The UPDATE
  // runs only on the upgrade that first adds the column — once it exists this
  // block is skipped, so it never clobbers a user's later choice.
  if (!phaseHas.has('tiebreaker')) {
    await db.execAsync(
      `ALTER TABLE phases ADD COLUMN tiebreaker TEXT NOT NULL DEFAULT 'fifa';`
    );
    await db.execAsync(`UPDATE phases SET tiebreaker = 'conmebol';`);
  }

  // v10: participants gain optional icon + icon_color (curated badge picker).
  // Default NULL so all existing participants render exactly as before.
  const partCols = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(participants);'
  );
  const partHas = new Set(partCols.map((c) => c.name));
  if (!partHas.has('icon')) {
    await db.execAsync(`ALTER TABLE participants ADD COLUMN icon TEXT;`);
  }
  if (!partHas.has('icon_color')) {
    await db.execAsync(`ALTER TABLE participants ADD COLUMN icon_color TEXT;`);
  }

  // Step 3b (v3): backfill phases for tournaments that don't have any yet,
  // then link existing matches.phase_id by mapping stage → phase ordinal.
  await backfillPhases(db);

  // Step 4: bump user_version
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

/**
 * One-shot v3→v4 step: rebuild `tournaments` if its current SQL still
 * contains the strict CHECK on `type`. SQLite has no ALTER ... DROP
 * CONSTRAINT, so we recreate the table without the CHECK and copy data.
 *
 * Run before BASE_TABLES (which uses CREATE IF NOT EXISTS, so it would no-op).
 * Idempotent: detection short-circuits on already-relaxed schemas.
 */
async function rebuildTournamentsIfStrictCheck(
  db: SQLite.SQLiteDatabase
): Promise<void> {
  const row = await db.getFirstAsync<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='tournaments';"
  );
  const sql = row?.sql ?? '';
  if (!sql) return; // table doesn't exist yet; BASE_TABLES will create it
  if (!/CHECK\s*\(\s*type\s+IN/i.test(sql)) return; // already relaxed

  // FK enforcement off during the swap so DROP TABLE doesn't fail on
  // participants/matches/phases that reference tournaments(id). The data
  // they reference doesn't change — we keep the same row ids.
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      await db.execAsync(
        `CREATE TABLE tournaments_v4 (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ongoing','finished')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );`
      );
      await db.execAsync(
        `INSERT INTO tournaments_v4 (id, name, type, status, created_at)
         SELECT id, name, type, status, created_at FROM tournaments;`
      );
      await db.execAsync('DROP TABLE tournaments;');
      await db.execAsync('ALTER TABLE tournaments_v4 RENAME TO tournaments;');
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
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
          (tournament_id, ordinal, name, format, legs, group_count, qualifiers,
           status, scoring, third_place, bracket_reset, tiebreaker)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          t.id,
          p.ordinal,
          p.name,
          p.format,
          p.legs,
          p.groupCount,
          p.qualifiers,
          'pending',
          p.scoring,
          p.thirdPlace ? 1 : 0,
          p.bracketReset ? 1 : 0,
          // Legacy tournaments predate per-phase tiebreakers — keep their
          // old ranking order (points→H2H→GD→GF→name = 'conmebol').
          'conmebol',
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
  format:
    | 'single_elimination'
    | 'double_elimination'
    | 'round_robin'
    | 'placement_playoff';
  legs: 1 | 2;
  groupCount: number;
  qualifiers: number | null;
  scoring: 'fifa' | 'volleyball';
  tiebreaker: 'fifa' | 'conmebol' | 'volleyball';
  thirdPlace: boolean;
  bracketReset: boolean;
}

/**
 * Default phase shape for each tournament type. Exported for use by
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
          scoring: 'fifa',
          tiebreaker: 'fifa',
          thirdPlace: false,
          bracketReset: false,
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
          scoring: 'fifa',
          tiebreaker: 'fifa',
          thirdPlace: false,
          bracketReset: false,
        },
        {
          ordinal: 1,
          name: 'Mata-mata',
          format: 'single_elimination',
          legs: 1,
          groupCount: 1,
          qualifiers: null,
          scoring: 'fifa',
          tiebreaker: 'fifa',
          thirdPlace: false,
          bracketReset: false,
        },
      ];
    case 'league_playoff':
      return [
        {
          ordinal: 0,
          name: 'Liga',
          format: 'round_robin',
          legs: 2,
          groupCount: 1,
          qualifiers: 4,
          // The preset is built around the vôlei use case (top-4 disputam
          // final + 3º lugar after a double round-robin); FIVB scoring is
          // the natural default. Users wanting FIFA on this shape pick
          // "Personalizado" and configure scoring=Futebol.
          scoring: 'volleyball',
          // Vôlei: pontos → vitórias → saldo de sets → sets pró → confronto.
          tiebreaker: 'volleyball',
          thirdPlace: false,
          bracketReset: false,
        },
        {
          ordinal: 1,
          name: 'Playoffs',
          format: 'placement_playoff',
          legs: 1,
          groupCount: 1,
          qualifiers: null,
          scoring: 'fifa',
          tiebreaker: 'fifa',
          thirdPlace: false,
          bracketReset: false,
        },
      ];
    case 'double_elimination':
      return [
        {
          ordinal: 0,
          name: 'Dupla eliminação',
          format: 'double_elimination',
          legs: 1,
          groupCount: 1,
          qualifiers: null,
          scoring: 'fifa',
          tiebreaker: 'fifa',
          thirdPlace: false,
          bracketReset: false,
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
          scoring: 'fifa',
          tiebreaker: 'fifa',
          thirdPlace: false,
          bracketReset: false,
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
