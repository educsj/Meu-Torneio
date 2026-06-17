import type { Scorer, ScorerInput } from '@/types/tournament';
import type { ScorerEntry } from '@/utils/stats';

import { getDatabase } from './index';

interface ScorerRow {
  id: number;
  match_id: number;
  participant_id: number | null;
  name: string;
  goals: number;
}

function rowToScorer(row: ScorerRow): Scorer {
  return {
    id: row.id,
    matchId: row.match_id,
    participantId: row.participant_id,
    name: row.name,
    goals: row.goals,
  };
}

/** Scorers recorded for a single match, in insertion order. */
export async function listScorersForMatch(
  matchId: number
): Promise<Scorer[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ScorerRow>(
    `SELECT id, match_id, participant_id, name, goals
     FROM scorers WHERE match_id = ? ORDER BY id ASC;`,
    [matchId]
  );
  return rows.map(rowToScorer);
}

/**
 * Replace the full set of scorers for a match. Blank names and non-positive
 * goal counts are dropped. Runs in a transaction so the match never ends up
 * with a half-written scorer list.
 */
export async function setScorersForMatch(
  matchId: number,
  scorers: ScorerInput[]
): Promise<void> {
  const db = await getDatabase();
  const clean = scorers
    .map((s) => ({
      participantId: s.participantId,
      name: s.name.trim(),
      goals: Math.floor(s.goals),
    }))
    .filter((s) => s.name.length > 0 && s.goals > 0);

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM scorers WHERE match_id = ?;', [matchId]);
    for (const s of clean) {
      await db.runAsync(
        `INSERT INTO scorers (match_id, participant_id, name, goals)
         VALUES (?, ?, ?, ?);`,
        [matchId, s.participantId, s.name, s.goals]
      );
    }
  });
}

/** Drop every scorer for a match (used when a result is cleared). */
export async function deleteScorersForMatch(matchId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM scorers WHERE match_id = ?;', [matchId]);
}

/**
 * Every scorer line across all tournaments, flattened for the top-scorer
 * ranking. Joins through matches to recover which tournament each goal
 * belongs to. Aggregation by player name lives in `aggregateScorers`.
 */
export async function listAllScorerEntries(): Promise<ScorerEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    name: string;
    goals: number;
    match_id: number;
    tournament_id: number;
  }>(
    `SELECT s.name AS name, s.goals AS goals, s.match_id AS match_id,
            m.tournament_id AS tournament_id
     FROM scorers s
     JOIN matches m ON m.id = s.match_id;`
  );
  return rows.map((r) => ({
    name: r.name,
    goals: r.goals,
    matchId: r.match_id,
    tournamentId: r.tournament_id,
  }));
}
