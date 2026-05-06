import type { Participant } from '@/types/tournament';

import { getDatabase } from './index';

interface ParticipantRow {
  id: number;
  tournament_id: number;
  name: string;
  seed: number | null;
  icon: string | null;
  icon_color: string | null;
}

function rowToParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    seed: row.seed,
    icon: row.icon,
    iconColor: row.icon_color,
  };
}

export async function listParticipants(
  tournamentId: number
): Promise<Participant[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ParticipantRow>(
    `SELECT id, tournament_id, name, seed, icon, icon_color
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
  icon?: string | null;
  iconColor?: string | null;
}): Promise<Participant> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO participants (tournament_id, name, seed, icon, icon_color)
     VALUES (?, ?, ?, ?, ?);`,
    [
      input.tournamentId,
      input.name,
      input.seed ?? null,
      input.icon ?? null,
      input.iconColor ?? null,
    ]
  );
  const row = await db.getFirstAsync<ParticipantRow>(
    `SELECT id, tournament_id, name, seed, icon, icon_color
     FROM participants WHERE id = ?;`,
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

/** Update the badge (icon id + color) of an existing participant. Pass null
 *  to clear the badge and fall back to plain initials in the UI. */
export async function updateParticipantIcon(
  id: number,
  icon: string | null,
  iconColor: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE participants SET icon = ?, icon_color = ? WHERE id = ?;',
    [icon, iconColor, id]
  );
}
