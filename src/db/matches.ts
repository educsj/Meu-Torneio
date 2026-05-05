import type { Match, Participant } from '@/types/tournament';
import { generateSingleEliminationBracket } from '@/utils/bracket';

import { getDatabase } from './index';
import { listParticipants } from './participants';

interface MatchRow {
  id: number;
  tournament_id: number;
  round: number;
  participant_a_id: number | null;
  participant_b_id: number | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: number | null;
  next_match_id: number | null;
  scheduled_at: string | null;
  location: string | null;
}

function rowToMatch(row: MatchRow): Match {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    round: row.round,
    participantAId: row.participant_a_id,
    participantBId: row.participant_b_id,
    scoreA: row.score_a,
    scoreB: row.score_b,
    winnerId: row.winner_id,
    nextMatchId: row.next_match_id,
    scheduledAt: row.scheduled_at,
    location: row.location,
  };
}

export async function listMatches(tournamentId: number): Promise<Match[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MatchRow>(
    `SELECT id, tournament_id, round, participant_a_id, participant_b_id,
            score_a, score_b, winner_id, next_match_id, scheduled_at, location
     FROM matches
     WHERE tournament_id = ?
     ORDER BY round, id;`,
    [tournamentId]
  );
  return rows.map(rowToMatch);
}

export async function deleteMatchesForTournament(
  tournamentId: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM matches WHERE tournament_id = ?;', [
    tournamentId,
  ]);
}

/**
 * Generate the bracket for a tournament's current participant list and
 * persist the matches. Returns the inserted matches in flat order.
 *
 * Existing matches for this tournament are deleted first, so calling
 * this acts as a "reset bracket" too.
 */
export async function generateBracketForTournament(
  tournamentId: number
): Promise<Match[]> {
  const participants = await listParticipants(tournamentId);
  if (participants.length < 2) {
    throw new Error('Need at least 2 participants to generate a bracket');
  }

  const bracket = generateSingleEliminationBracket(participants);

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM matches WHERE tournament_id = ?;', [
      tournamentId,
    ]);

    // Insert from highest round to lowest so earlier rounds know the next
    // round's match id to point to.
    const totalRounds = Math.max(...bracket.map((m) => m.round));
    const insertedIdByRoundIndex = new Map<string, number>();

    for (let r = totalRounds; r >= 1; r--) {
      const matchesInRound = bracket
        .filter((m) => m.round === r)
        .sort((a, b) => a.indexInRound - b.indexInRound);

      for (const m of matchesInRound) {
        const nextMatchId =
          m.nextRoundIndex !== null
            ? (insertedIdByRoundIndex.get(
                `${m.round + 1}-${m.nextRoundIndex}`
              ) ?? null)
            : null;
        const result = await db.runAsync(
          `INSERT INTO matches
            (tournament_id, round, participant_a_id, participant_b_id,
             winner_id, next_match_id)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [
            tournamentId,
            m.round,
            m.participantAId,
            m.participantBId,
            m.winnerId,
            nextMatchId,
          ]
        );
        insertedIdByRoundIndex.set(
          `${m.round}-${m.indexInRound}`,
          result.lastInsertRowId
        );
      }
    }

    // Propagate BYE winners forward: if a round-1 match has winner from BYE,
    // place that winner into the appropriate slot of its next match.
    const firstRound = bracket
      .filter((m) => m.round === 1 && m.winnerId !== null)
      .sort((a, b) => a.indexInRound - b.indexInRound);
    for (const m of firstRound) {
      if (m.nextRoundIndex === null) continue;
      const nextId = insertedIdByRoundIndex.get(
        `2-${m.nextRoundIndex}`
      );
      if (!nextId) continue;
      const slot = m.indexInRound % 2 === 0 ? 'participant_a_id' : 'participant_b_id';
      await db.runAsync(
        `UPDATE matches SET ${slot} = ? WHERE id = ?;`,
        [m.winnerId, nextId]
      );
    }
  });

  return listMatches(tournamentId);
}

/**
 * Convenience: returns whether the tournament currently has any matches.
 */
export async function hasMatches(tournamentId: number): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM matches WHERE tournament_id = ?;',
    [tournamentId]
  );
  return (row?.c ?? 0) > 0;
}

export type ParticipantById = Map<number, Participant>;

export async function loadParticipantsAsMap(
  tournamentId: number
): Promise<ParticipantById> {
  const list = await listParticipants(tournamentId);
  return new Map(list.map((p) => [p.id, p]));
}
