import type { Participant } from '@/types/tournament';

import { getDatabase } from './index';

interface ParticipantRow {
  id: number;
  tournament_id: number;
  name: string;
  seed: number | null;
}

function rowToParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    seed: row.seed,
  };
}

export async function listParticipants(
  tournamentId: number
): Promise<Participant[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ParticipantRow>(
    `SELECT id, tournament_id, name, seed
     FROM participants
     WHERE tournament_id = ?
     ORDER BY COALESCE(seed, 999999), id;`,
    [tournamentId]
  );
  return rows.map(rowToParticipant);
}

export async function createParticipant(input: {
  tournamentId: number;
  name: string;
  seed?: number | null;
}): Promise<Participant> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO participants (tournament_id, name, seed) VALUES (?, ?, ?);',
    [input.tournamentId, input.name, input.seed ?? null]
  );
  const row = await db.getFirstAsync<ParticipantRow>(
    'SELECT id, tournament_id, name, seed FROM participants WHERE id = ?;',
    [result.lastInsertRowId]
  );
  if (!row) throw new Error('Failed to load created participant');
  return rowToParticipant(row);
}

export async function deleteParticipant(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM participants WHERE id = ?;', [id]);
}

export async function renameParticipant(
  id: number,
  name: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE participants SET name = ? WHERE id = ?;', [
    name,
    id,
  ]);
}
