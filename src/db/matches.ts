import type {
  Match,
  Participant,
  TournamentType,
} from '@/types/tournament';
import {
  generateRoundRobinMatches,
  generateSingleEliminationBracket,
  type BracketMatch,
} from '@/utils/bracket';

import { getDatabase } from './index';
import { listParticipants } from './participants';
import { getTournamentById } from './tournaments';

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
 * Generate matches for a tournament according to its type and persist them.
 * Returns the inserted matches in flat order. Existing matches for this
 * tournament are deleted first, so calling this acts as a "reset" too.
 *
 * Currently supports:
 *  - single_elimination: standard bracket with auto BYEs
 *  - round_robin: every participant plays every other once
 */
export async function generateBracketForTournament(
  tournamentId: number
): Promise<Match[]> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('Torneio não encontrado.');
  if (tournament.type === 'groups_knockout') {
    throw new Error(
      'Geração de Grupos + Mata-mata ainda não está disponível.'
    );
  }

  const participants = await listParticipants(tournamentId);
  if (participants.length < 2) {
    throw new Error('Adicione pelo menos 2 participantes.');
  }

  const bracket: BracketMatch[] =
    tournament.type === 'round_robin'
      ? generateRoundRobinMatches(participants)
      : generateSingleEliminationBracket(participants);

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

/**
 * Update the score of a match. Computes the winner (or null on a draw),
 * persists scores + winner_id, and propagates the winner into the slot of
 * the next match if there is one.
 *
 * Pass `allowDraws=false` for single elimination (default). For round-robin
 * pass `allowDraws=true`.
 */
export async function setMatchScore(
  matchId: number,
  scoreA: number,
  scoreB: number,
  options?: { allowDraws?: boolean }
): Promise<void> {
  const allowDraws = options?.allowDraws ?? false;
  if (!allowDraws && scoreA === scoreB) {
    throw new Error('Empates não são permitidos nesse formato.');
  }
  const db = await getDatabase();
  const match = await db.getFirstAsync<MatchRow>(
    `SELECT id, tournament_id, round, participant_a_id, participant_b_id,
            score_a, score_b, winner_id, next_match_id, scheduled_at, location
     FROM matches WHERE id = ?;`,
    [matchId]
  );
  if (!match) throw new Error('Partida não encontrada.');
  if (match.participant_a_id == null || match.participant_b_id == null) {
    throw new Error(
      'Esta partida ainda não tem dois participantes definidos.'
    );
  }

  const winnerId =
    scoreA === scoreB
      ? null
      : scoreA > scoreB
        ? match.participant_a_id
        : match.participant_b_id;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE matches SET score_a = ?, score_b = ?, winner_id = ? WHERE id = ?;',
      [scoreA, scoreB, winnerId, matchId]
    );
    await propagateWinnerToNextMatch(match, winnerId);
  });
}

/**
 * Clear a match's score and winner. Also clears the slot in the next match
 * that this match feeds into (since the previous winner no longer applies).
 */
export async function clearMatchScore(matchId: number): Promise<void> {
  const db = await getDatabase();
  const match = await db.getFirstAsync<MatchRow>(
    `SELECT id, tournament_id, round, participant_a_id, participant_b_id,
            score_a, score_b, winner_id, next_match_id, scheduled_at, location
     FROM matches WHERE id = ?;`,
    [matchId]
  );
  if (!match) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE matches SET score_a = NULL, score_b = NULL, winner_id = NULL WHERE id = ?;',
      [matchId]
    );
    await propagateWinnerToNextMatch(match, null);
  });
}

/**
 * Place (or clear) a winner into the appropriate slot of `match.next_match_id`.
 * Slot is determined by which child this match is of the parent: among the
 * matches in the SAME round that share the same `next_match_id`, the one
 * with the smaller `id` goes to slot A, the other to slot B.
 *
 * Also clears any score on the next match whenever the slot changes — its
 * previous outcome no longer reflects who's actually playing.
 */
async function propagateWinnerToNextMatch(
  match: MatchRow,
  newWinnerId: number | null
): Promise<void> {
  if (match.next_match_id == null) return;
  const db = await getDatabase();
  const siblings = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM matches WHERE next_match_id = ? AND round = ? ORDER BY id ASC;',
    [match.next_match_id, match.round]
  );
  const slotIsA = siblings.length > 0 && siblings[0].id === match.id;
  const slotCol = slotIsA ? 'participant_a_id' : 'participant_b_id';

  await db.runAsync(
    `UPDATE matches
     SET ${slotCol} = ?, score_a = NULL, score_b = NULL, winner_id = NULL
     WHERE id = ?;`,
    [newWinnerId, match.next_match_id]
  );
}

/**
 * Compute and persist the tournament status based on its matches.
 *
 * - Single elimination: finished when the final has a winner; ongoing if
 *   any match has been played; otherwise draft.
 * - Round robin: finished when every match has a score recorded (draws
 *   count as played); ongoing if any match has a score; otherwise draft.
 */
export async function recomputeTournamentStatus(
  tournamentId: number
): Promise<'draft' | 'ongoing' | 'finished' | null> {
  const db = await getDatabase();
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return null;

  const all = await db.getAllAsync<MatchRow>(
    `SELECT id, round, score_a, score_b, winner_id, next_match_id
     FROM matches WHERE tournament_id = ?;`,
    [tournamentId]
  );
  if (all.length === 0) return null;

  const isPlayed = (m: MatchRow) => m.score_a != null && m.score_b != null;
  const anyPlayed = all.some(isPlayed);

  let next: 'draft' | 'ongoing' | 'finished';
  if (tournament.type === 'single_elimination') {
    const final = all.find((m) => m.next_match_id == null);
    if (final && final.winner_id != null) next = 'finished';
    else if (anyPlayed) next = 'ongoing';
    else next = 'draft';
  } else {
    const allPlayed = all.every(isPlayed);
    if (allPlayed) next = 'finished';
    else if (anyPlayed) next = 'ongoing';
    else next = 'draft';
  }

  await db.runAsync('UPDATE tournaments SET status = ? WHERE id = ?;', [
    next,
    tournamentId,
  ]);
  return next;
}

export function tournamentTypeAllowsDraws(type: TournamentType): boolean {
  return type !== 'single_elimination';
}
