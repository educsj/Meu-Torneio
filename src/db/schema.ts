export const SCHEMA_VERSION = 2;

/**
 * Base v1 schema — idempotent (CREATE TABLE IF NOT EXISTS).
 * Always run on every app open; harmless if tables already exist.
 */
export const BASE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('single_elimination','round_robin','groups_knockout')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ongoing','finished')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    seed INTEGER
  );`,
  `CREATE INDEX IF NOT EXISTS idx_participants_tournament
    ON participants(tournament_id);`,
  `CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    participant_a_id INTEGER REFERENCES participants(id) ON DELETE SET NULL,
    participant_b_id INTEGER REFERENCES participants(id) ON DELETE SET NULL,
    score_a INTEGER,
    score_b INTEGER,
    winner_id INTEGER REFERENCES participants(id) ON DELETE SET NULL,
    next_match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,
    scheduled_at TEXT,
    location TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_matches_tournament
    ON matches(tournament_id);`,
];

/**
 * Columns we want on the `matches` table beyond the v1 baseline.
 * Each entry is { column name → ALTER TABLE statement }. Migration code
 * checks PRAGMA table_info to add only what's missing — making it safe to
 * re-run after a partial / failed previous attempt.
 *
 * Important: ADD COLUMN with CHECK constraints is unreliable across SQLite
 * versions, so we omit CHECKs here and validate at the app layer instead.
 */
export const MATCHES_EXTRA_COLUMNS: Record<string, string> = {
  group_label: `ALTER TABLE matches ADD COLUMN group_label TEXT;`,
  stage: `ALTER TABLE matches ADD COLUMN stage TEXT DEFAULT 'main';`,
};
