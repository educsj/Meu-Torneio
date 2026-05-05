import { describe, expect, it } from 'vitest';

import type { Match, Participant, Tournament } from '@/types/tournament';

import {
  BACKUP_VERSION,
  BackupParseError,
  parseBackup,
  serializeTournament,
  suggestedBackupFilename,
} from './exportImport';

const t: Tournament = {
  id: 7,
  name: 'Copa de Verão',
  type: 'single_elimination',
  status: 'ongoing',
  createdAt: '2026-05-01T10:00:00Z',
};

const ps: Participant[] = [
  { id: 11, tournamentId: 7, name: 'Time A', seed: 1 },
  { id: 12, tournamentId: 7, name: 'Time B', seed: 2 },
  { id: 13, tournamentId: 7, name: 'Time C', seed: null },
];

const ms: Match[] = [
  {
    id: 21,
    tournamentId: 7,
    round: 1,
    participantAId: 11,
    participantBId: 12,
    scoreA: 3,
    scoreB: 1,
    winnerId: 11,
    nextMatchId: 22,
    scheduledAt: '2026-05-10T19:30:00Z',
    location: 'Quadra Central',
    groupLabel: null,
    stage: 'main',
  },
  {
    id: 22,
    tournamentId: 7,
    round: 2,
    participantAId: 11,
    participantBId: null,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    nextMatchId: null,
    scheduledAt: null,
    location: null,
    groupLabel: null,
    stage: 'main',
  },
];

describe('serializeTournament', () => {
  it('produces a backup with the current version and exportedAt timestamp', () => {
    const backup = serializeTournament(t, ps, ms);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('strips the autoincrement id and keeps name/type/status/createdAt', () => {
    const backup = serializeTournament(t, ps, ms);
    expect(backup.tournament).toEqual({
      name: 'Copa de Verão',
      type: 'single_elimination',
      status: 'ongoing',
      createdAt: '2026-05-01T10:00:00Z',
    });
  });

  it('preserves participant ids as localId for cross-reference', () => {
    const backup = serializeTournament(t, ps, ms);
    expect(backup.participants).toEqual([
      { localId: 11, name: 'Time A', seed: 1 },
      { localId: 12, name: 'Time B', seed: 2 },
      { localId: 13, name: 'Time C', seed: null },
    ]);
  });

  it('preserves match ids and cross-references', () => {
    const backup = serializeTournament(t, ps, ms);
    expect(backup.matches).toHaveLength(2);
    expect(backup.matches[0]).toMatchObject({
      localId: 21,
      participantALocalId: 11,
      participantBLocalId: 12,
      winnerLocalId: 11,
      nextMatchLocalId: 22,
      scheduledAt: '2026-05-10T19:30:00Z',
      location: 'Quadra Central',
    });
    expect(backup.matches[1]).toMatchObject({
      localId: 22,
      nextMatchLocalId: null,
    });
  });
});

describe('parseBackup', () => {
  it('round-trips a serialized backup', () => {
    const backup = serializeTournament(t, ps, ms);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed).toEqual(backup);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseBackup('{not json')).toThrow(BackupParseError);
  });

  it('throws when version is missing', () => {
    expect(() => parseBackup('{}')).toThrow(/version/i);
  });

  it('throws when version is newer than supported', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({ version: BACKUP_VERSION + 1, tournament: {}, participants: [], matches: [] })
      )
    ).toThrow(/atualize|update/i);
  });

  it('throws on invalid tournament type', () => {
    const bad = serializeTournament(t, ps, ms);
    const corrupted: Record<string, unknown> = JSON.parse(JSON.stringify(bad));
    (corrupted.tournament as Record<string, unknown>).type = 'pingpong';
    expect(() => parseBackup(JSON.stringify(corrupted))).toThrow(/tipo/i);
  });

  it('throws on invalid status', () => {
    const bad = serializeTournament(t, ps, ms);
    const corrupted: Record<string, unknown> = JSON.parse(JSON.stringify(bad));
    (corrupted.tournament as Record<string, unknown>).status = 'paused';
    expect(() => parseBackup(JSON.stringify(corrupted))).toThrow(/status/i);
  });

  it('throws when participants is not an array', () => {
    const bad = serializeTournament(t, ps, ms);
    const corrupted = { ...bad, participants: 'not an array' as unknown };
    expect(() => parseBackup(JSON.stringify(corrupted))).toThrow(/array/i);
  });

  it('throws when a participant is missing fields', () => {
    const bad = serializeTournament(t, ps, ms);
    const corrupted = { ...bad, participants: [{ localId: 1 }] };
    expect(() => parseBackup(JSON.stringify(corrupted))).toThrow(/participante/i);
  });

  it('throws when a match is missing required fields', () => {
    const bad = serializeTournament(t, ps, ms);
    const corrupted = { ...bad, matches: [{ localId: 1, round: 1 }] };
    expect(() => parseBackup(JSON.stringify(corrupted))).toThrow(/partida/i);
  });
});

describe('suggestedBackupFilename', () => {
  it('slugifies and dates the name', () => {
    expect(suggestedBackupFilename('Copa de Verão', '2026-05-05T00:00:00Z')).toBe(
      'copa-de-verao-2026-05-05.json'
    );
  });

  it('handles names with only special chars', () => {
    expect(suggestedBackupFilename('!!!', '2026-05-05T00:00:00Z')).toBe(
      'torneio-2026-05-05.json'
    );
  });

  it('truncates very long names', () => {
    const long = 'a'.repeat(100);
    const out = suggestedBackupFilename(long, '2026-05-05T00:00:00Z');
    expect(out.length).toBeLessThanOrEqual(80);
  });
});
