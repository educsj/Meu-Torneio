export const SCHEMA_VERSION = 10;

/**
 * Base schema — idempotent (CREATE TABLE IF NOT EXISTS).
 *
 * Note: `tournaments.type` has no CHECK constraint. New formats are added
 * frequently and SQLite makes it expensive to relax CHECK after the fact
 * (requires a table rebuild). Validation lives at the TypeScript layer.
 */
export const BASE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ongoing','finished')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    seed INTEGER,
    icon TEXT,
    icon_color TEXT
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
  /* v3: phases table — see migrate(). Idempotent. v5 adds `scoring`,
     v7 adds `third_place`, v9 adds `bracket_reset`. */
  `CREATE TABLE IF NOT EXISTS phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    name TEXT NOT NULL,
    format TEXT NOT NULL,
    legs INTEGER NOT NULL DEFAULT 1,
    group_count INTEGER NOT NULL DEFAULT 1,
    qualifiers INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    scoring TEXT NOT NULL DEFAULT 'fifa',
    third_place INTEGER NOT NULL DEFAULT 0,
    bracket_reset INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_phases_tournament
    ON phases(tournament_id);`,
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
  /* v3: link each match to its phase. ON DELETE SET NULL keeps history when
     a phase is deleted; matches.phase_id is filled by backfill in migrate(). */
  phase_id: `ALTER TABLE matches ADD COLUMN phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL;`,
  /* v6: walkover flag. 0/1 boolean — true when the match was decided by
     forfeit; false otherwise. Existing matches default to 0. */
  walkover: `ALTER TABLE matches ADD COLUMN walkover INTEGER NOT NULL DEFAULT 0;`,
  /* v8: where the LOSER of this match drops to (double-elimination only).
     ON DELETE SET NULL keeps history when a match is deleted. Null for any
     non-DE match. */
  loser_next_match_id: `ALTER TABLE matches ADD COLUMN loser_next_match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL;`,
  /* v8: explicit slot ('A' or 'B') the winner / loser fills in the next
     match. NULL falls back to the legacy "siblings sorted by id → A is
     the smaller-id sibling" rule used by single-elim. DE matches need
     explicit slots because winner-from-LB and loser-from-WB land in the
     same downstream match without a clean sibling ordering. */
  next_slot: `ALTER TABLE matches ADD COLUMN next_slot TEXT;`,
  loser_next_slot: `ALTER TABLE matches ADD COLUMN loser_next_slot TEXT;`,
};
