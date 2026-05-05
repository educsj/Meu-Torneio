import type {
  Match,
  MatchStage,
  Participant,
  Phase,
  TournamentType,
} from '@/types/tournament';
import { type BracketMatch } from '@/utils/bracket';
import {
  computeMinParticipantsForPhases,
  generateBracketFromPhases,
} from '@/utils/bracketOrchestrator';
import {
  computeGroupsKnockoutSeeding,
  computeLeaguePlayoffSeeding,
} from '@/utils/playoffSeeding';
import { computeTournamentStatus } from '@/utils/tournamentStatus';

import { getDatabase } from './index';
import { listParticipants } from './participants';
import { listPhases, resetPhasesForType } from './phases';
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
  group_label: string | null;
  stage: MatchStage;
  phase_id: number | null;
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
    groupLabel: row.group_label,
    stage: row.stage,
    phaseId: row.phase_id,
  };
}

export async function listMatches(tournamentId: number): Promise<Match[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MatchRow>(
    `SELECT id, tournament_id, round, participant_a_id, participant_b_id,
            score_a, score_b, winner_id, next_match_id, scheduled_at, location,
            group_label, stage, phase_id
     FROM matches
     WHERE tournament_id = ?
     ORDER BY stage, round, id;`,
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

  const participants = await listParticipants(tournamentId);

  // Phases drive both the participant minimum and the bracket shape.
  // resetPhasesForType is a safety net for tournaments created before the
  // phase model landed (their phases would be empty until backfilled).
  let phases = await listPhases(tournamentId);
  if (phases.length === 0) {
    phases = await resetPhasesForType(tournamentId, tournament.type);
  }

  const min = computeMinParticipantsForPhases(phases);
  if (participants.length < min) {
    throw new Error(`Adicione pelo menos ${min} participantes.`);
  }

  const bracket: BracketMatch[] = generateBracketFromPhases(phases, participants);
  const stageToPhaseId = buildStageToPhaseIdMap(tournament.type, phases);

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM matches WHERE tournament_id = ?;', [
      tournamentId,
    ]);

    // Group/knockout-aware insertion: insert highest round per stage first
    // so earlier rounds within the same stage know the next match id.
    const stages: MatchStage[] = ['main', 'group', 'knockout'];
    const insertedIdByKey = new Map<string, number>(); // `${stage}-${round}-${idx}`

    for (const stage of stages) {
      const stageMatches = bracket.filter(
        (m) => (m.stage ?? 'main') === stage
      );
      if (stageMatches.length === 0) continue;
      const totalRounds = Math.max(...stageMatches.map((m) => m.round));
      for (let r = totalRounds; r >= 1; r--) {
        const inRound = stageMatches
          .filter((m) => m.round === r)
          .sort((a, b) => a.indexInRound - b.indexInRound);
        for (const m of inRound) {
          const nextMatchId =
            m.nextRoundIndex !== null
              ? (insertedIdByKey.get(
                  `${stage}-${m.round + 1}-${m.nextRoundIndex}`
                ) ?? null)
              : null;
          const result = await db.runAsync(
            `INSERT INTO matches
              (tournament_id, round, participant_a_id, participant_b_id,
               winner_id, next_match_id, group_label, stage, phase_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              tournamentId,
              m.round,
              m.participantAId,
              m.participantBId,
              m.winnerId,
              nextMatchId,
              m.groupLabel ?? null,
              stage,
              stageToPhaseId.get(stage) ?? null,
            ]
          );
          insertedIdByKey.set(
            `${stage}-${m.round}-${m.indexInRound}`,
            result.lastInsertRowId
          );
        }
      }
    }

    // Propagate BYE winners forward (only for single-elim main stage).
    const seByes = bracket
      .filter(
        (m) =>
          (m.stage ?? 'main') === 'main' &&
          m.round === 1 &&
          m.winnerId !== null
      )
      .sort((a, b) => a.indexInRound - b.indexInRound);
    for (const m of seByes) {
      if (m.nextRoundIndex === null) continue;
      const nextId = insertedIdByKey.get(`main-2-${m.nextRoundIndex}`);
      if (!nextId) continue;
      const slot =
        m.indexInRound % 2 === 0 ? 'participant_a_id' : 'participant_b_id';
      await db.runAsync(`UPDATE matches SET ${slot} = ? WHERE id = ?;`, [
        m.winnerId,
        nextId,
      ]);
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
 * Update the scheduled date/time and location of a match. Both fields are
 * independent of the score — you can schedule a match before it happens and
 * later record the result, or skip scheduling entirely. Pass null to clear.
 */
export async function setMatchSchedule(
  matchId: number,
  scheduledAt: string | null,
  location: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE matches SET scheduled_at = ?, location = ? WHERE id = ?;',
    [scheduledAt, location, matchId]
  );
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
    `SELECT id, round, score_a, score_b, winner_id, next_match_id, stage
     FROM matches WHERE tournament_id = ?;`,
    [tournamentId]
  );

  const next = computeTournamentStatus(
    tournament.type,
    all.map((m) => ({
      stage: m.stage,
      scoreA: m.score_a,
      scoreB: m.score_b,
      winnerId: m.winner_id,
      nextMatchId: m.next_match_id,
    }))
  );
  if (next == null) return null;

  await db.runAsync('UPDATE tournaments SET status = ? WHERE id = ?;', [
    next,
    tournamentId,
  ]);
  return next;
}

export function tournamentTypeAllowsDraws(type: TournamentType): boolean {
  return type !== 'single_elimination';
}

/**
 * Map a match's `stage` to the id of the phase it belongs to, given the
 * tournament's type and its phases (ordered by ordinal).
 *
 *   single_elimination / round_robin → all stages map to the only phase
 *   groups_knockout / league_playoff → 'group' → phase[0], 'knockout' → phase[1]
 */
function buildStageToPhaseIdMap(
  type: TournamentType,
  phases: Phase[]
): Map<MatchStage, number> {
  const byOrdinal = new Map(phases.map((p) => [p.ordinal, p.id]));
  const map = new Map<MatchStage, number>();
  if (type === 'groups_knockout' || type === 'league_playoff') {
    const group = byOrdinal.get(0);
    const knockout = byOrdinal.get(1);
    if (group != null) map.set('group', group);
    if (knockout != null) map.set('knockout', knockout);
  } else {
    const main = byOrdinal.get(0);
    if (main != null) map.set('main', main);
  }
  return map;
}

/**
 * Returns true if all group-stage matches of a groups+knockout tournament
 * have been played. Used to know when to seed the knockout bracket.
 */
export async function isGroupStageComplete(
  tournamentId: number
): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ score_a: number | null; score_b: number | null }>(
    `SELECT score_a, score_b FROM matches
     WHERE tournament_id = ? AND stage = 'group';`,
    [tournamentId]
  );
  if (rows.length === 0) return false;
  return rows.every((r) => r.score_a != null && r.score_b != null);
}

/**
 * Phase-driven seeder: looks at phase 1's format and dispatches to the
 * appropriate playoff-seeding function. No-op for single-phase tournaments
 * or unsupported phase compositions. Replaces the type-specific calls in
 * the store so custom tournaments seed correctly without per-type branching.
 */
export async function seedNextPhase(tournamentId: number): Promise<void> {
  const phases = await listPhases(tournamentId);
  const target = phases.find((p) => p.ordinal === 1);
  if (!target) return;
  if (target.format === 'single_elimination') {
    await seedKnockoutFromGroups(tournamentId);
  } else if (target.format === 'placement_playoff') {
    await seedPlayoffFromLeague(tournamentId);
  }
  // round_robin → round_robin chains aren't seeded automatically yet.
}

/**
 * After the league phase of a league_playoff tournament finishes, fill in
 * the placement matches: 1st vs 2nd (the final) and 3rd vs 4th (3rd-place).
 * Idempotent — recomputes standings and overwrites slots, so re-running
 * after a late score correction is safe.
 */
export async function seedPlayoffFromLeague(
  tournamentId: number
): Promise<void> {
  const db = await getDatabase();
  const allMatches = await listMatches(tournamentId);
  const leagueMatches = allMatches.filter((m) => m.stage === 'group');
  const participants = await listParticipants(tournamentId);
  const seeding = computeLeaguePlayoffSeeding(leagueMatches, participants);
  if (!seeding) return;

  const playoff = allMatches
    .filter((m) => m.stage === 'knockout')
    .sort((a, b) => a.id - b.id);
  if (playoff.length < seeding.length) return;

  // playoff[0] = final (1st vs 2nd); playoff[1] = 3rd-place (3rd vs 4th).
  for (let i = 0; i < seeding.length; i++) {
    await db.runAsync(
      `UPDATE matches
       SET participant_a_id = ?, participant_b_id = ?,
           score_a = NULL, score_b = NULL, winner_id = NULL
       WHERE id = ?;`,
      [seeding[i].participantAId, seeding[i].participantBId, playoff[i].id]
    );
  }
}

/**
 * After the group stage of a groups+knockout tournament finishes, fill in
 * the semifinal slots: 1A vs 2B and 1B vs 2A. Idempotent — safe to call
 * multiple times; will just rewrite the slots.
 */
export async function seedKnockoutFromGroups(
  tournamentId: number
): Promise<void> {
  const db = await getDatabase();
  const allMatches = await listMatches(tournamentId);
  const groupMatches = allMatches.filter((m) => m.stage === 'group');
  const participants = await listParticipants(tournamentId);
  const seeding = computeGroupsKnockoutSeeding(groupMatches, participants);
  if (!seeding) return;

  const knockout = allMatches
    .filter((m) => m.stage === 'knockout' && m.round === 1)
    .sort((m1, m2) => m1.id - m2.id);
  if (knockout.length < seeding.length) return;

  // Apply each cross-pairing to a semifinal slot.
  for (let i = 0; i < seeding.length; i++) {
    await db.runAsync(
      `UPDATE matches
       SET participant_a_id = ?, participant_b_id = ?,
           score_a = NULL, score_b = NULL, winner_id = NULL
       WHERE id = ?;`,
      [seeding[i].participantAId, seeding[i].participantBId, knockout[i].id]
    );
  }

  // Final: clear slots in case they carry stale winners from a previous
  // seeding (e.g. user edits a group score and the semifinal pairings shift).
  const final = allMatches.find(
    (m) => m.stage === 'knockout' && m.round === 2
  );
  if (final) {
    await db.runAsync(
      `UPDATE matches
       SET participant_a_id = NULL, participant_b_id = NULL,
           score_a = NULL, score_b = NULL, winner_id = NULL
       WHERE id = ?;`,
      [final.id]
    );
  }
}
