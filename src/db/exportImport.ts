import type { Tournament } from '@/types/tournament';
import {
  parseBackup,
  serializeTournament,
  type TournamentBackup,
} from '@/utils/exportImport';

import { getDatabase } from './index';
import { listMatches } from './matches';
import { listParticipants } from './participants';
import { createDefaultPhasesForType, listPhases } from './phases';
import { getTournamentById } from './tournaments';

/**
 * Read a tournament + its participants + matches and return a backup blob
 * (already JSON.stringified, ready to be written to a file).
 */
export async function exportTournamentJson(
  tournamentId: number
): Promise<{ filename: string; json: string; backup: TournamentBackup }> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('Torneio não encontrado.');
  const [participants, matches, phases] = await Promise.all([
    listParticipants(tournamentId),
    listMatches(tournamentId),
    listPhases(tournamentId),
  ]);
  const backup = serializeTournament(tournament, participants, matches, phases);
  const json = JSON.stringify(backup, null, 2);
  // Imported lazily to avoid a circular import — the suggested-name helper
  // lives in the pure-logic module.
  const { suggestedBackupFilename } = await import('@/utils/exportImport');
  return {
    filename: suggestedBackupFilename(tournament.name, backup.exportedAt),
    json,
    backup,
  };
}

/**
 * Import a tournament backup. Always inserts as a NEW tournament (never
 * overwrites). Re-maps localIds → freshly assigned ids inside a transaction.
 *
 * Returns the newly created tournament id.
 */
export async function importTournamentJson(json: string): Promise<number> {
  const backup = parseBackup(json);
  const db = await getDatabase();

  let newTournamentId = 0;

  await db.withTransactionAsync(async () => {
    // 1) tournament
    const tInsert = await db.runAsync(
      `INSERT INTO tournaments (name, type, status, created_at)
       VALUES (?, ?, ?, ?);`,
      [
        backup.tournament.name,
        backup.tournament.type,
        backup.tournament.status,
        backup.tournament.createdAt,
      ]
    );
    newTournamentId = tInsert.lastInsertRowId;

    // 1b) phases. Two paths:
    //   v2 backup with phases array → insert them verbatim, build phaseLocalId
    //                                  → newPhaseId map for matches.
    //   v1 backup (no phases) → fall back to defaultPhasesForType + stage map.
    const phaseIdMap = new Map<number, number>();
    const stageToPhaseId = new Map<string, number>();
    if (backup.phases && backup.phases.length > 0) {
      for (const p of backup.phases) {
        const r = await db.runAsync(
          `INSERT INTO phases
            (tournament_id, ordinal, name, format, legs, group_count, qualifiers, status, scoring)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            newTournamentId,
            p.ordinal,
            p.name,
            p.format,
            p.legs,
            p.groupCount,
            p.qualifiers,
            p.status,
            // pre-v5 v2 backups omit scoring — fall back to 'fifa'.
            p.scoring ?? 'fifa',
          ]
        );
        phaseIdMap.set(p.localId, r.lastInsertRowId);
      }
    } else {
      const phases = await createDefaultPhasesForType(
        newTournamentId,
        backup.tournament.type
      );
      if (backup.tournament.type === 'groups_knockout') {
        const group = phases.find((p) => p.ordinal === 0)?.id;
        const knockout = phases.find((p) => p.ordinal === 1)?.id;
        if (group != null) stageToPhaseId.set('group', group);
        if (knockout != null) stageToPhaseId.set('knockout', knockout);
      } else {
        const main = phases.find((p) => p.ordinal === 0)?.id;
        if (main != null) stageToPhaseId.set('main', main);
      }
    }

    // 2) participants — keep mapping localId → newId
    const participantIdMap = new Map<number, number>();
    for (const p of backup.participants) {
      const r = await db.runAsync(
        `INSERT INTO participants (tournament_id, name, seed)
         VALUES (?, ?, ?);`,
        [newTournamentId, p.name, p.seed ?? null]
      );
      participantIdMap.set(p.localId, r.lastInsertRowId);
    }

    // 3) matches — first pass inserts with NULL next_match_id, capturing
    // the new id for each localId. Second pass updates next_match_id once
    // all matches are inserted.
    const matchIdMap = new Map<number, number>();
    const remap = (localId: number | null): number | null =>
      localId == null ? null : (participantIdMap.get(localId) ?? null);

    for (const m of backup.matches) {
      const stage = m.stage ?? 'main';
      // v2 backups carry phaseLocalId per match → use the map. v1 backups
      // don't, so fall back to the stage→phase_id mapping built earlier.
      const phaseId =
        m.phaseLocalId != null
          ? (phaseIdMap.get(m.phaseLocalId) ?? null)
          : (stageToPhaseId.get(stage) ?? null);
      const r = await db.runAsync(
        `INSERT INTO matches
          (tournament_id, round, participant_a_id, participant_b_id,
           score_a, score_b, winner_id, next_match_id, scheduled_at, location,
           group_label, stage, phase_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?);`,
        [
          newTournamentId,
          m.round,
          remap(m.participantALocalId),
          remap(m.participantBLocalId),
          m.scoreA,
          m.scoreB,
          remap(m.winnerLocalId),
          m.scheduledAt,
          m.location,
          m.groupLabel,
          stage,
          phaseId,
        ]
      );
      matchIdMap.set(m.localId, r.lastInsertRowId);
    }

    for (const m of backup.matches) {
      if (m.nextMatchLocalId == null) continue;
      const nextNew = matchIdMap.get(m.nextMatchLocalId);
      const meNew = matchIdMap.get(m.localId);
      if (!nextNew || !meNew) continue;
      await db.runAsync('UPDATE matches SET next_match_id = ? WHERE id = ?;', [
        nextNew,
        meNew,
      ]);
    }
  });

  return newTournamentId;
}

export type { Tournament };
