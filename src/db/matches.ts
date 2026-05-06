import type {
  Match,
  MatchStage,
  Participant,
  Phase,
  TournamentType,
} from '@/types/tournament';
import { THIRD_PLACE_LABEL, type BracketMatch } from '@/utils/bracket';
import {
  computeMinParticipantsForPhases,
  generateBracketFromPhases,
} from '@/utils/bracketOrchestrator';
import {
  computeGroupsKnockoutSeeding,
  computeLeaguePlayoffSeeding,
  computeSingleLeagueBracketSeeding,
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
  loser_next_match_id: number | null;
  /** v8 (DE only). When set, overrides the "siblings sorted by id" rule
   * used by single-elim winner propagation. */
  next_slot: string | null;
  loser_next_slot: string | null;
  scheduled_at: string | null;
  location: string | null;
  group_label: string | null;
  stage: MatchStage;
  phase_id: number | null;
  walkover: number;
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
    loserNextMatchId: row.loser_next_match_id,
    scheduledAt: row.scheduled_at,
    location: row.location,
    groupLabel: row.group_label,
    stage: row.stage,
    phaseId: row.phase_id,
    walkover: row.walkover === 1,
  };
}

export async function listMatches(tournamentId: number): Promise<Match[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MatchRow>(
    `SELECT id, tournament_id, round, participant_a_id, participant_b_id,
            score_a, score_b, winner_id, next_match_id, loser_next_match_id,
            scheduled_at, location, group_label, stage, phase_id, walkover
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
    // Key includes groupLabel because double elimination can have multiple
    // matches sharing the same (stage, round, indexInRound) coordinate but
    // distinguished by WB / LB / GF.
    const stages: MatchStage[] = ['main', 'group', 'knockout'];
    const insertedIdByKey = new Map<string, number>();
    const keyOf = (
      stage: MatchStage | string,
      groupLabel: string | null | undefined,
      round: number,
      idx: number
    ) => `${stage}-${groupLabel ?? ''}-${round}-${idx}`;

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
          // Legacy same-group nextRoundIndex still works for SE / groups+SE.
          // DE matches use winnerDest* (resolved in the post-pass below) and
          // leave nextRoundIndex null.
          const nextMatchId =
            m.nextRoundIndex !== null
              ? (insertedIdByKey.get(
                  keyOf(stage, m.groupLabel, m.round + 1, m.nextRoundIndex)
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
            keyOf(stage, m.groupLabel, m.round, m.indexInRound),
            result.lastInsertRowId
          );
        }
      }
    }

    // Cross-group destinations (double elimination): now that every match
    // has an id, wire next_match_id + next_slot and loser_next_match_id +
    // loser_next_slot for any match that declared winnerDest* / loserDest*.
    for (const m of bracket) {
      if (!m.winnerDestGroup && !m.loserDestGroup) continue;
      const stage = m.stage ?? 'main';
      const myId = insertedIdByKey.get(
        keyOf(stage, m.groupLabel, m.round, m.indexInRound)
      );
      if (!myId) continue;
      if (
        m.winnerDestGroup &&
        m.winnerDestRound != null &&
        m.winnerDestIndex != null
      ) {
        const targetId = insertedIdByKey.get(
          keyOf(stage, m.winnerDestGroup, m.winnerDestRound, m.winnerDestIndex)
        );
        if (targetId) {
          await db.runAsync(
            'UPDATE matches SET next_match_id = ?, next_slot = ? WHERE id = ?;',
            [targetId, m.winnerDestSlot ?? null, myId]
          );
        }
      }
      if (
        m.loserDestGroup &&
        m.loserDestRound != null &&
        m.loserDestIndex != null
      ) {
        const targetId = insertedIdByKey.get(
          keyOf(stage, m.loserDestGroup, m.loserDestRound, m.loserDestIndex)
        );
        if (targetId) {
          await db.runAsync(
            'UPDATE matches SET loser_next_match_id = ?, loser_next_slot = ? WHERE id = ?;',
            [targetId, m.loserDestSlot ?? null, myId]
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
      const nextId = insertedIdByKey.get(
        keyOf('main', m.groupLabel, 2, m.nextRoundIndex)
      );
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
  options?: { allowDraws?: boolean; walkover?: boolean }
): Promise<void> {
  const allowDraws = options?.allowDraws ?? false;
  const walkover = options?.walkover ?? false;
  if (!walkover && !allowDraws && scoreA === scoreB) {
    throw new Error('Empates não são permitidos nesse formato.');
  }
  if (walkover && scoreA === scoreB) {
    throw new Error('Walkover precisa de um vencedor (placares diferentes).');
  }
  const db = await getDatabase();
  const match = await db.getFirstAsync<MatchRow>(
    `SELECT id, tournament_id, round, participant_a_id, participant_b_id,
            score_a, score_b, winner_id, next_match_id, loser_next_match_id,
            next_slot, loser_next_slot, scheduled_at, location
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
  const loserId =
    winnerId == null
      ? null
      : winnerId === match.participant_a_id
        ? match.participant_b_id
        : match.participant_a_id;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE matches SET score_a = ?, score_b = ?, winner_id = ?, walkover = ? WHERE id = ?;',
      [scoreA, scoreB, winnerId, walkover ? 1 : 0, matchId]
    );
    await propagateWinnerToNextMatch(match, winnerId);
    await propagateLoserToThirdPlace(match, loserId);
    await propagateLoserToLoserNext(match, loserId);
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
            score_a, score_b, winner_id, next_match_id, loser_next_match_id,
            next_slot, loser_next_slot, scheduled_at, location
     FROM matches WHERE id = ?;`,
    [matchId]
  );
  if (!match) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE matches SET score_a = NULL, score_b = NULL, winner_id = NULL, walkover = 0 WHERE id = ?;',
      [matchId]
    );
    await propagateWinnerToNextMatch(match, null);
    await propagateLoserToThirdPlace(match, null);
    await propagateLoserToLoserNext(match, null);
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
  // DE matches store an explicit next_slot at generation time; fall back to
  // the legacy "siblings sorted by id, smaller-id → slot A" rule for SE.
  let slotCol: 'participant_a_id' | 'participant_b_id';
  if (match.next_slot === 'A' || match.next_slot === 'B') {
    slotCol = match.next_slot === 'A' ? 'participant_a_id' : 'participant_b_id';
  } else {
    const siblings = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM matches WHERE next_match_id = ? AND round = ? ORDER BY id ASC;',
      [match.next_match_id, match.round]
    );
    const slotIsA = siblings.length > 0 && siblings[0].id === match.id;
    slotCol = slotIsA ? 'participant_a_id' : 'participant_b_id';
  }

  await db.runAsync(
    `UPDATE matches
     SET ${slotCol} = ?, score_a = NULL, score_b = NULL, winner_id = NULL
     WHERE id = ?;`,
    [newWinnerId, match.next_match_id]
  );
}

/**
 * Double-elimination loser propagation: when a WB match has a recorded
 * loser, drop them into the LB slot that was wired up at generation time.
 * No-op for matches without an explicit loser destination (i.e. anything
 * outside DE; the SE 3rd-place playoff uses its own dedicated function).
 */
async function propagateLoserToLoserNext(
  match: MatchRow,
  newLoserId: number | null
): Promise<void> {
  if (match.loser_next_match_id == null) return;
  if (match.loser_next_slot !== 'A' && match.loser_next_slot !== 'B') return;
  const db = await getDatabase();
  const slotCol =
    match.loser_next_slot === 'A' ? 'participant_a_id' : 'participant_b_id';
  await db.runAsync(
    `UPDATE matches
     SET ${slotCol} = ?, score_a = NULL, score_b = NULL, winner_id = NULL
     WHERE id = ?;`,
    [newLoserId, match.loser_next_match_id]
  );
}

/**
 * If `match` is a semifinal of a SE bracket that has a 3rd-place playoff,
 * place `newLoserId` into the appropriate slot of the 3P match (and clear
 * any prior score so the slot change doesn't leave a stale outcome). No-op
 * for any non-SF match (detected by the absence of a 3P match in the round
 * above this one).
 *
 * Slot rule: among the SFs sharing this match's `next_match_id` (the final),
 * the smaller-id one feeds slot A of the 3P, the other slot B — same
 * convention as winner→final propagation, so the same SF always feeds the
 * same slot in both downstream matches.
 */
async function propagateLoserToThirdPlace(
  match: MatchRow,
  newLoserId: number | null
): Promise<void> {
  if (match.next_match_id == null) return;
  const db = await getDatabase();
  const final = await db.getFirstAsync<{
    tournament_id: number;
    stage: string;
  }>(
    'SELECT tournament_id, stage FROM matches WHERE id = ?;',
    [match.next_match_id]
  );
  if (!final) return;
  const thirdPlace = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM matches
     WHERE tournament_id = ? AND stage = ? AND round = ? AND group_label = ?;`,
    [final.tournament_id, final.stage, match.round + 1, THIRD_PLACE_LABEL]
  );
  if (!thirdPlace) return;
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
    [newLoserId, thirdPlace.id]
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
    `SELECT id, round, score_a, score_b, winner_id, next_match_id, stage, group_label
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
      groupLabel: m.group_label,
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
  // The league phase (ordinal 0) carries the scoring rule that applies to
  // its standings — pass it through so playoff seeding uses the right
  // points (e.g. vôlei 3-2-1-0 vs FIFA 3-1-0).
  const phases = await listPhases(tournamentId);
  const sourcePhase = phases.find((p) => p.ordinal === 0);
  const seeding = computeLeaguePlayoffSeeding(leagueMatches, participants, {
    scoring: sourcePhase?.scoring,
  });
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
  const phases = await listPhases(tournamentId);
  const sourcePhase = phases.find((p) => p.ordinal === 0);

  // Pick the right seeder based on the source phase's shape:
  //   - Multi-group (groupCount ≥ 2): cross-pair top of each group (existing
  //     groups+knockout behavior).
  //   - Single-group (groupCount = 1): take top-K from the league's
  //     standings and seed them into the bracket via NCAA-style positions.
  let seeding;
  if (sourcePhase && sourcePhase.groupCount === 1) {
    const qualifiers = sourcePhase.qualifiers ?? 4;
    seeding = computeSingleLeagueBracketSeeding(
      groupMatches,
      participants,
      qualifiers,
      { scoring: sourcePhase.scoring }
    );
  } else {
    seeding = computeGroupsKnockoutSeeding(groupMatches, participants, {
      scoring: sourcePhase?.scoring,
    });
  }
  if (!seeding) return;

  const knockoutR1 = allMatches
    .filter((m) => m.stage === 'knockout' && m.round === 1)
    .sort((m1, m2) => m1.id - m2.id);
  if (knockoutR1.length < seeding.length) return;

  // Apply each pairing to a round-1 slot.
  for (let i = 0; i < seeding.length; i++) {
    await db.runAsync(
      `UPDATE matches
       SET participant_a_id = ?, participant_b_id = ?,
           score_a = NULL, score_b = NULL, winner_id = NULL
       WHERE id = ?;`,
      [seeding[i].participantAId, seeding[i].participantBId, knockoutR1[i].id]
    );
  }

  // Later rounds: clear any stale slots and scores so the bracket can
  // re-propagate from round 1 cleanly. Without this a re-seed after a
  // group-stage score correction could leave a finalist slotted with
  // someone the new R1 winners would never produce.
  const laterRounds = allMatches.filter(
    (m) => m.stage === 'knockout' && m.round > 1
  );
  for (const m of laterRounds) {
    await db.runAsync(
      `UPDATE matches
       SET participant_a_id = NULL, participant_b_id = NULL,
           score_a = NULL, score_b = NULL, winner_id = NULL
       WHERE id = ?;`,
      [m.id]
    );
  }
}
