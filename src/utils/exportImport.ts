import type {
  Match,
  Participant,
  Phase,
  PhaseFormat,
  PhaseStatus,
  ScoringRule,
  Tournament,
  TournamentType,
} from '@/types/tournament';

/**
 * Versioned snapshot of a single tournament + its participants, matches,
 * and (v2+) phases.
 *
 * v1 → v2 changes:
 *   - Added optional top-level `phases` array.
 *   - Added optional `phaseLocalId` on each match (FK into phases[].localId).
 *
 * v1 backups remain importable: phases are reconstructed from the legacy
 * `tournament.type` via defaultPhasesForType, and matches' phase_id is
 * inferred from `stage`. Custom tournaments require v2 (phases array).
 */
export interface TournamentBackup {
  version: number;
  exportedAt: string;
  tournament: {
    name: string;
    type: TournamentType;
    status: Tournament['status'];
    createdAt: string;
  };
  participants: Array<{
    /** Original id; only used to wire up matches inside the backup. */
    localId: number;
    name: string;
    seed: number | null;
  }>;
  /** v2+. Absent on v1 backups. */
  phases?: Array<{
    localId: number;
    ordinal: number;
    name: string;
    format: PhaseFormat;
    legs: 1 | 2;
    groupCount: number;
    qualifiers: number | null;
    status: PhaseStatus;
    /** v2 backups created before per-phase scoring may omit this; treat
     * absent as 'fifa' on import. */
    scoring?: ScoringRule;
  }>;
  matches: Array<{
    localId: number;
    round: number;
    stage: Match['stage'];
    groupLabel: string | null;
    /** localId references into participants[].localId. */
    participantALocalId: number | null;
    participantBLocalId: number | null;
    scoreA: number | null;
    scoreB: number | null;
    winnerLocalId: number | null;
    /** localId references into matches[].localId. */
    nextMatchLocalId: number | null;
    /** localId references into phases[].localId. v2+; absent on v1. */
    phaseLocalId?: number | null;
    scheduledAt: string | null;
    location: string | null;
    /** v6+. Absent backups default to false. */
    walkover?: boolean;
  }>;
}

export const BACKUP_VERSION = 2;
const VALID_PHASE_FORMATS: PhaseFormat[] = [
  'single_elimination',
  'round_robin',
  'placement_playoff',
];
const VALID_PHASE_STATUS: PhaseStatus[] = ['pending', 'ongoing', 'finished'];
const VALID_SCORING: ScoringRule[] = ['fifa', 'volleyball'];
const VALID_TYPES: TournamentType[] = [
  'single_elimination',
  'round_robin',
  'groups_knockout',
  'league_playoff',
  'custom',
];
const VALID_STATUS: Tournament['status'][] = ['draft', 'ongoing', 'finished'];

/**
 * Serialize a tournament + its participants + its matches into a backup
 * object. Uses original DB ids as `localId` so cross-references survive
 * the round-trip even though they'll be re-mapped on import.
 */
export function serializeTournament(
  tournament: Tournament,
  participants: Participant[],
  matches: Match[],
  phases: Phase[] = []
): TournamentBackup {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tournament: {
      name: tournament.name,
      type: tournament.type,
      status: tournament.status,
      createdAt: tournament.createdAt,
    },
    participants: participants.map((p) => ({
      localId: p.id,
      name: p.name,
      seed: p.seed,
    })),
    phases: phases.map((p) => ({
      localId: p.id,
      ordinal: p.ordinal,
      name: p.name,
      format: p.format,
      legs: p.legs,
      groupCount: p.groupCount,
      qualifiers: p.qualifiers,
      status: p.status,
      scoring: p.scoring,
    })),
    matches: matches.map((m) => ({
      localId: m.id,
      round: m.round,
      stage: m.stage,
      groupLabel: m.groupLabel,
      participantALocalId: m.participantAId,
      participantBLocalId: m.participantBId,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winnerLocalId: m.winnerId,
      nextMatchLocalId: m.nextMatchId,
      phaseLocalId: m.phaseId,
      scheduledAt: m.scheduledAt,
      location: m.location,
      walkover: m.walkover,
    })),
  };
}

export class BackupParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupParseError';
  }
}

/**
 * Parse + validate a JSON string as a TournamentBackup. Throws
 * BackupParseError with a human-readable message on any structural problem.
 */
export function parseBackup(json: string): TournamentBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new BackupParseError(`JSON inválido: ${(err as Error).message}`);
  }

  if (!raw || typeof raw !== 'object') {
    throw new BackupParseError('Esperado um objeto JSON na raiz.');
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.version !== 'number') {
    throw new BackupParseError('Campo "version" ausente ou inválido.');
  }
  if (obj.version > BACKUP_VERSION) {
    throw new BackupParseError(
      `Versão de backup ${obj.version} mais nova que a suportada (${BACKUP_VERSION}). Atualize o app.`
    );
  }

  const t = obj.tournament as Record<string, unknown> | undefined;
  if (!t || typeof t !== 'object') {
    throw new BackupParseError('Campo "tournament" ausente.');
  }
  if (typeof t.name !== 'string' || !t.name.trim()) {
    throw new BackupParseError('Nome do torneio ausente.');
  }
  if (
    typeof t.type !== 'string' ||
    !VALID_TYPES.includes(t.type as TournamentType)
  ) {
    throw new BackupParseError(`Tipo de torneio inválido: ${String(t.type)}`);
  }
  if (
    typeof t.status !== 'string' ||
    !VALID_STATUS.includes(t.status as Tournament['status'])
  ) {
    throw new BackupParseError(`Status inválido: ${String(t.status)}`);
  }

  const ps = obj.participants;
  if (!Array.isArray(ps)) {
    throw new BackupParseError('Campo "participants" deve ser um array.');
  }
  for (const [i, raw] of ps.entries()) {
    const pp = raw as Record<string, unknown>;
    if (typeof pp?.localId !== 'number' || typeof pp?.name !== 'string') {
      throw new BackupParseError(
        `Participante #${i + 1} mal formado (esperado { localId, name }).`
      );
    }
  }

  const ms = obj.matches;
  if (!Array.isArray(ms)) {
    throw new BackupParseError('Campo "matches" deve ser um array.');
  }
  for (const [i, raw] of ms.entries()) {
    const mm = raw as Record<string, unknown>;
    if (
      typeof mm?.localId !== 'number' ||
      typeof mm?.round !== 'number' ||
      typeof mm?.stage !== 'string'
    ) {
      throw new BackupParseError(
        `Partida #${i + 1} mal formada (esperado { localId, round, stage, ... }).`
      );
    }
  }

  // v2 phases: optional on input. When present each entry must be well-formed.
  // When type='custom', phases are mandatory — there's no fallback shape.
  const phasesRaw = obj.phases;
  const hasPhases = Array.isArray(phasesRaw) && phasesRaw.length > 0;
  if (phasesRaw !== undefined && !Array.isArray(phasesRaw)) {
    throw new BackupParseError('Campo "phases" deve ser um array.');
  }
  if (hasPhases) {
    for (const [i, raw] of phasesRaw.entries()) {
      const pp = raw as Record<string, unknown>;
      if (
        typeof pp?.localId !== 'number' ||
        typeof pp?.ordinal !== 'number' ||
        typeof pp?.name !== 'string' ||
        typeof pp?.format !== 'string' ||
        !VALID_PHASE_FORMATS.includes(pp.format as PhaseFormat) ||
        typeof pp?.legs !== 'number' ||
        (pp.legs !== 1 && pp.legs !== 2) ||
        typeof pp?.groupCount !== 'number' ||
        (pp.qualifiers != null && typeof pp.qualifiers !== 'number') ||
        typeof pp?.status !== 'string' ||
        !VALID_PHASE_STATUS.includes(pp.status as PhaseStatus)
      ) {
        throw new BackupParseError(
          `Fase #${i + 1} mal formada (esperado { localId, ordinal, name, format, legs, groupCount, qualifiers, status }).`
        );
      }
      // scoring is optional for backwards compat with v2 backups created
      // before per-phase scoring shipped — they get 'fifa' on import.
      if (
        pp.scoring != null &&
        (typeof pp.scoring !== 'string' ||
          !VALID_SCORING.includes(pp.scoring as ScoringRule))
      ) {
        throw new BackupParseError(
          `Fase #${i + 1}: pontuação inválida (${String(pp.scoring)}).`
        );
      }
    }
  } else if (t.type === 'custom') {
    throw new BackupParseError(
      'Backup de torneio personalizado precisa incluir as fases (versão 2+).'
    );
  }

  return raw as TournamentBackup;
}

/**
 * Suggested filename for a tournament export, sanitized for filesystem.
 * e.g. "Copa de Verão" → "copa-de-verao-2026-05-05.json"
 */
export function suggestedBackupFilename(
  tournamentName: string,
  exportedAt: string = new Date().toISOString()
): string {
  const date = exportedAt.slice(0, 10);
  const slug = tournamentName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'torneio'}-${date}.json`;
}
