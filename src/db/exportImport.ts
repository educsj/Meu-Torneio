import type { Tournament } from '@/types/tournament';
import {
  parseBackup,
  serializeTournament,
  type TournamentBackup,
} from '@/utils/exportImport';

import { getDatabase } from './index';
import { listMatches } from './matches';
import { listParticipants } from './participants';
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
  const [participants, matches] = await Promise.all([
    listParticipants(tournamentId),
    listMatches(tournamentId),
  ]);
  const backup = serializeTournament(tournament, participants, matches);
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
      const r = await db.runAsync(
        `INSERT INTO matches
          (tournament_id, round, participant_a_id, participant_b_id,
           score_a, score_b, winner_id, next_match_id, scheduled_at, location,
           group_label, stage)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?);`,
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
          m.stage ?? 'main',
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
