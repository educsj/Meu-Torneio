import type {
  Match,
  Participant,
  ScoringRule,
  TiebreakerPreset,
} from '@/types/tournament';

export interface StandingRow {
  participantId: number;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

interface MatchPoints {
  /** Points awarded to A. */
  a: number;
  /** Points awarded to B. */
  b: number;
  /** Whether A is the match winner (false on draw or B-win). */
  aWin: boolean;
  /** Whether B is the match winner. */
  bWin: boolean;
  /** True only when scores are equal. */
  draw: boolean;
}

/**
 * Map a single match score to standings points under the given rule.
 *
 *   'fifa'       → win 3 / draw 1 / loss 0 (football-style; default)
 *   'volleyball' → 3-0 or 3-1: 3-0 / 3-2: 2-1 / 1-3 or 0-3: 0-3
 *                  (FIVB; "scoreA"/"scoreB" represent sets won)
 *
 * Wins/losses/draws are decided by score comparison regardless of rule;
 * only the points distribution differs.
 */
export function pointsForMatch(
  scoreA: number,
  scoreB: number,
  rule: ScoringRule
): MatchPoints {
  if (rule === 'volleyball') {
    if (scoreA > scoreB) {
      // 3-0/3-1 (margin ≥ 2) → 3-0; 3-2 (margin 1) → 2-1
      const dominant = scoreA - scoreB >= 2;
      return {
        a: dominant ? 3 : 2,
        b: dominant ? 0 : 1,
        aWin: true,
        bWin: false,
        draw: false,
      };
    }
    if (scoreB > scoreA) {
      const dominant = scoreB - scoreA >= 2;
      return {
        a: dominant ? 0 : 1,
        b: dominant ? 3 : 2,
        aWin: false,
        bWin: true,
        draw: false,
      };
    }
    // Volleyball doesn't allow draws but be defensive: 0-0 if entered.
    return { a: 0, b: 0, aWin: false, bWin: false, draw: true };
  }

  // FIFA-style
  if (scoreA > scoreB) {
    return { a: 3, b: 0, aWin: true, bWin: false, draw: false };
  }
  if (scoreB > scoreA) {
    return { a: 0, b: 3, aWin: false, bWin: true, draw: false };
  }
  return { a: 1, b: 1, aWin: false, bWin: false, draw: true };
}

/**
 * A single tiebreaker step, applied in order. 'head_to_head' builds a
 * mini-table among the still-tied teams (mini-points → mini-goal-diff →
 * mini-goals-for); the others are simple overall fields compared descending
 * (except 'name', ascending). 'name' is the deterministic final fallback and
 * is appended automatically when a preset omits it.
 */
export type TiebreakerCriterion =
  | 'points'
  | 'wins'
  | 'goal_diff'
  | 'goals_for'
  | 'head_to_head'
  | 'name';

/**
 * The criterion order behind each named preset (see TiebreakerPreset).
 *   fifa       → points → GD → GF → head-to-head → name
 *   conmebol   → points → head-to-head → GD → GF → name
 *   volleyball → points → wins → set-diff → sets-won → head-to-head → name
 *
 * For volleyball, scoreA/scoreB are sets, so goalDiff == set-diff and
 * goalsFor == sets won — the closest honest mapping to the FIVB criteria
 * given we only store set tallies (not per-set points).
 */
export const TIEBREAKER_PRESETS: Record<
  TiebreakerPreset,
  TiebreakerCriterion[]
> = {
  fifa: ['points', 'goal_diff', 'goals_for', 'head_to_head', 'name'],
  conmebol: ['points', 'head_to_head', 'goal_diff', 'goals_for', 'name'],
  volleyball: [
    'points',
    'wins',
    'goal_diff',
    'goals_for',
    'head_to_head',
    'name',
  ],
};

/**
 * Order used when no tiebreaker is specified. Matches the behavior shipped
 * before configurable tiebreakers existed (points → H2H → GD → GF → name) so
 * existing tournaments rank identically — this is the 'conmebol' preset.
 */
const DEFAULT_TIEBREAKER: TiebreakerCriterion[] = TIEBREAKER_PRESETS.conmebol;

function resolveCriteria(
  tiebreaker?: TiebreakerPreset | TiebreakerCriterion[]
): TiebreakerCriterion[] {
  let criteria: TiebreakerCriterion[];
  if (!tiebreaker) criteria = DEFAULT_TIEBREAKER;
  else if (Array.isArray(tiebreaker)) criteria = tiebreaker;
  else criteria = TIEBREAKER_PRESETS[tiebreaker] ?? DEFAULT_TIEBREAKER;
  // Guarantee a deterministic final fallback.
  return criteria.includes('name') ? criteria : [...criteria, 'name'];
}

/**
 * Compute a standings table from a list of matches and participants.
 *
 * The tiebreaker order is configurable via `options.tiebreaker` — either a
 * named preset ('fifa' | 'conmebol' | 'volleyball') or an explicit criterion
 * list. When omitted it falls back to the legacy points → H2H → GD → GF →
 * name order, so callers that don't pass one keep their previous behavior.
 *
 * Head-to-head only kicks in when 2+ teams remain tied after the prior
 * criteria; the mini-table is built from the subset of matches where BOTH
 * participants are in the tied group, so it works correctly inside a
 * multi-group tournament too.
 */
export function computeStandings(
  matches: Match[],
  participants: Participant[],
  options: {
    scoring?: ScoringRule;
    tiebreaker?: TiebreakerPreset | TiebreakerCriterion[];
  } = {}
): StandingRow[] {
  const scoring = options.scoring ?? 'fifa';
  const criteria = resolveCriteria(options.tiebreaker);
  const baseRows = accumulateStats(matches, participants, scoring);
  return rankRows(baseRows, matches, scoring, criteria);
}

/** Walk the matches once, tally per-participant counters. Returns the
 *  unsorted rows keyed by participant id. */
function accumulateStats(
  matches: Match[],
  participants: Participant[],
  scoring: ScoringRule
): StandingRow[] {
  const rows = new Map<number, StandingRow>();
  for (const p of participants) {
    rows.set(p.id, {
      participantId: p.id,
      name: p.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    if (
      m.participantAId == null ||
      m.participantBId == null ||
      m.scoreA == null ||
      m.scoreB == null
    ) {
      continue;
    }
    const rowA = rows.get(m.participantAId);
    const rowB = rows.get(m.participantBId);
    if (!rowA || !rowB) continue;

    rowA.played++;
    rowB.played++;
    rowA.goalsFor += m.scoreA;
    rowA.goalsAgainst += m.scoreB;
    rowB.goalsFor += m.scoreB;
    rowB.goalsAgainst += m.scoreA;

    const pts = pointsForMatch(m.scoreA, m.scoreB, scoring);
    rowA.points += pts.a;
    rowB.points += pts.b;
    if (pts.aWin) {
      rowA.wins++;
      rowB.losses++;
    } else if (pts.bWin) {
      rowB.wins++;
      rowA.losses++;
    } else {
      rowA.draws++;
      rowB.draws++;
    }
  }

  for (const r of rows.values()) {
    r.goalDiff = r.goalsFor - r.goalsAgainst;
  }
  return [...rows.values()];
}

/** Overall (non-H2H) numeric field for a criterion. Higher ranks first. */
function fieldValue(row: StandingRow, crit: TiebreakerCriterion): number {
  switch (crit) {
    case 'points':
      return row.points;
    case 'wins':
      return row.wins;
    case 'goal_diff':
      return row.goalDiff;
    case 'goals_for':
      return row.goalsFor;
    default:
      return 0;
  }
}

/**
 * Rank rows by applying the criteria in order. Each criterion sorts the
 * current group; any sub-run still tied on that criterion is broken by the
 * next criterion (recursively). 'head_to_head' ranks the tied group by a
 * mini-table of the matches played among them.
 */
function rankRows(
  rows: StandingRow[],
  allMatches: Match[],
  scoring: ScoringRule,
  criteria: TiebreakerCriterion[]
): StandingRow[] {
  function refine(group: StandingRow[], idx: number): StandingRow[] {
    if (group.length <= 1) return group;
    if (idx >= criteria.length) {
      // Exhausted every criterion; stable, deterministic fallback by id.
      return [...group].sort((a, b) => a.participantId - b.participantId);
    }
    const crit = criteria[idx];
    if (crit === 'name') {
      const sorted = [...group].sort((a, b) => a.name.localeCompare(b.name));
      return partition(sorted, idx, (a, b) => a.name.localeCompare(b.name) === 0);
    }
    if (crit === 'head_to_head') {
      return headToHead(group, idx);
    }
    const sorted = [...group].sort(
      (a, b) => fieldValue(b, crit) - fieldValue(a, crit)
    );
    return partition(
      sorted,
      idx,
      (a, b) => fieldValue(a, crit) === fieldValue(b, crit)
    );
  }

  /** Walk a sorted group, recursing into each run the current criterion left
   *  tied (per `equal`) with the next criterion. */
  function partition(
    sorted: StandingRow[],
    idx: number,
    equal: (a: StandingRow, b: StandingRow) => boolean
  ): StandingRow[] {
    const out: StandingRow[] = [];
    let k = 0;
    while (k < sorted.length) {
      let j = k;
      while (j + 1 < sorted.length && equal(sorted[j], sorted[j + 1])) j++;
      if (j > k) out.push(...refine(sorted.slice(k, j + 1), idx + 1));
      else out.push(sorted[k]);
      k = j + 1;
    }
    return out;
  }

  function headToHead(group: StandingRow[], idx: number): StandingRow[] {
    const tiedIds = new Set(group.map((r) => r.participantId));
    const h2hMatches = allMatches.filter(
      (m) =>
        m.participantAId != null &&
        m.participantBId != null &&
        tiedIds.has(m.participantAId) &&
        tiedIds.has(m.participantBId)
    );
    // No matches among the tied teams → can't break here; defer to next.
    if (h2hMatches.length === 0) return refine(group, idx + 1);
    const tiedParticipants: Participant[] = group.map((r) => ({
      id: r.participantId,
      tournamentId: 0,
      name: r.name,
      seed: null,
      icon: null,
      iconColor: null,
    }));
    const mini = accumulateStats(h2hMatches, tiedParticipants, scoring);
    const miniById = new Map(mini.map((r) => [r.participantId, r]));
    const miniKey = (r: StandingRow): [number, number, number] => {
      const mr = miniById.get(r.participantId);
      return mr ? [mr.points, mr.goalDiff, mr.goalsFor] : [0, 0, 0];
    };
    const sorted = [...group].sort((a, b) => {
      const ka = miniKey(a);
      const kb = miniKey(b);
      return kb[0] - ka[0] || kb[1] - ka[1] || kb[2] - ka[2];
    });
    return partition(sorted, idx, (a, b) => {
      const ka = miniKey(a);
      const kb = miniKey(b);
      return ka[0] === kb[0] && ka[1] === kb[1] && ka[2] === kb[2];
    });
  }

  return refine(rows, 0);
}
