import type {
  CustomPhaseInput,
  Phase,
  PhaseFormat,
  PhaseStatus,
} from '@/types/tournament';

import { defaultPhasesForType, getDatabase } from './index';

interface PhaseRow {
  id: number;
  tournament_id: number;
  ordinal: number;
  name: string;
  format: PhaseFormat;
  legs: number;
  group_count: number;
  qualifiers: number | null;
  status: PhaseStatus;
}

function rowToPhase(row: PhaseRow): Phase {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    ordinal: row.ordinal,
    name: row.name,
    format: row.format,
    legs: row.legs === 2 ? 2 : 1,
    groupCount: row.group_count,
    qualifiers: row.qualifiers,
    status: row.status,
  };
}

export async function listPhases(tournamentId: number): Promise<Phase[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PhaseRow>(
    `SELECT id, tournament_id, ordinal, name, format, legs, group_count,
            qualifiers, status
     FROM phases
     WHERE tournament_id = ?
     ORDER BY ordinal ASC;`,
    [tournamentId]
  );
  return rows.map(rowToPhase);
}

/**
 * Create the default phases for a freshly-created tournament, based on its
 * legacy `type`. Same shape used by the migration backfill, so old and new
 * tournaments stay structurally identical.
 */
export async function createDefaultPhasesForType(
  tournamentId: number,
  type: string
): Promise<Phase[]> {
  const db = await getDatabase();
  const phases = defaultPhasesForType(type);
  for (const p of phases) {
    await db.runAsync(
      `INSERT INTO phases
        (tournament_id, ordinal, name, format, legs, group_count, qualifiers, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        tournamentId,
        p.ordinal,
        p.name,
        p.format,
        p.legs,
        p.groupCount,
        p.qualifiers,
        'pending',
      ]
    );
  }
  return listPhases(tournamentId);
}

/**
 * Persist user-defined phases for a 'custom' tournament. Each phase is
 * inserted with the ordinal it appears at in the input array.
 */
export async function createCustomPhases(
  tournamentId: number,
  customPhases: CustomPhaseInput[]
): Promise<Phase[]> {
  if (customPhases.length === 0) {
    throw new Error('Custom tournament needs at least one phase.');
  }
  const db = await getDatabase();
  for (let i = 0; i < customPhases.length; i++) {
    const p = customPhases[i];
    await db.runAsync(
      `INSERT INTO phases
        (tournament_id, ordinal, name, format, legs, group_count, qualifiers, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        tournamentId,
        i,
        p.name,
        p.format,
        p.legs,
        p.groupCount,
        p.qualifiers,
        'pending',
      ]
    );
  }
  return listPhases(tournamentId);
}

/**
 * Delete and recreate phases for a tournament — used when regenerating the
 * bracket so phase_id mappings stay consistent. Idempotent.
 */
export async function resetPhasesForType(
  tournamentId: number,
  type: string
): Promise<Phase[]> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM phases WHERE tournament_id = ?;', [
    tournamentId,
  ]);
  return createDefaultPhasesForType(tournamentId, type);
}
