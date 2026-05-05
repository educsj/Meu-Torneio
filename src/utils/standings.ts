import type { Match, Participant, ScoringRule } from '@/types/tournament';

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
 * Compute a standings table from a list of matches and participants.
 *
 * Tiebreakers (in order): points desc, goal diff desc, goals for desc,
 * then name asc. Head-to-head is not yet applied.
 */
export function computeStandings(
  matches: Match[],
  participants: Participant[],
  options: { scoring?: ScoringRule } = {}
): StandingRow[] {
  const scoring = options.scoring ?? 'fifa';
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

  return [...rows.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });
}
