import type { Tournament, TournamentType } from '@/types/tournament';

import { getDatabase } from './index';

interface TournamentRow {
  id: number;
  name: string;
  type: Tournament['type'];
  status: Tournament['status'];
  created_at: string;
}

function rowToTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listTournaments(): Promise<Tournament[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TournamentRow>(
    'SELECT id, name, type, status, created_at FROM tournaments ORDER BY datetime(created_at) DESC;'
  );
  return rows.map(rowToTournament);
}

export async function createTournament(input: {
  name: string;
  type: TournamentType;
}): Promise<Tournament> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO tournaments (name, type) VALUES (?, ?);',
    [input.name, input.type]
  );
  const row = await db.getFirstAsync<TournamentRow>(
    'SELECT id, name, type, status, created_at FROM tournaments WHERE id = ?;',
    [result.lastInsertRowId]
  );
  if (!row) throw new Error('Failed to load created tournament');
  return rowToTournament(row);
}

export async function deleteTournament(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM tournaments WHERE id = ?;', [id]);
}
