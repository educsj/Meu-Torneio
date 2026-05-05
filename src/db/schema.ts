export const SCHEMA_VERSION = 2;

/**
 * Migrations are applied in order based on PRAGMA user_version.
 * Each entry is the FROM version (so MIGRATIONS[0] migrates 0 → 1, etc).
 */
export const MIGRATIONS: string[][] = [
  // 0 → 1: initial schema
  [
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
  ],
  // 1 → 2: groups stage support
  [
    `ALTER TABLE matches ADD COLUMN group_label TEXT;`,
    `ALTER TABLE matches ADD COLUMN stage TEXT NOT NULL DEFAULT 'main' CHECK (stage IN ('main','group','knockout'));`,
  ],
];

/** @deprecated Use MIGRATIONS instead. Kept for backwards compatibility. */
export const SCHEMA_STATEMENTS: string[] = MIGRATIONS[0];
