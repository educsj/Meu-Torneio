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
 * Tiebreaker order:
 *   1. points desc
 *   2. head-to-head (mini-table among the points-tied teams: mini-points
 *      → mini-goal-diff → mini-goals-for)
 *   3. goal diff desc (overall)
 *   4. goals for desc (overall)
 *   5. name asc
 *
 * H2H only kicks in when 2+ teams tie on points; for unique points there's
 * nothing to disambiguate. The mini-table is built from the subset of
 * matches where BOTH participants are in the tied group, so it works
 * correctly inside a multi-group tournament too.
 */
export function computeStandings(
  matches: Match[],
  participants: Participant[],
  options: { scoring?: ScoringRule } = {}
): StandingRow[] {
  const scoring = options.scoring ?? 'fifa';
  const baseRows = accumulateStats(matches, participants, scoring);
  const baseSorted = sortByOverall(baseRows);
  return applyHeadToHeadTiebreaker(baseSorted, matches, scoring);
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

/** Tiebreakers without head-to-head (used both as the base sort and
 *  inside the H2H mini-table). */
function sortByOverall(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });
}

/** For each consecutive run of points-tied rows, recompute the mini-table
 *  using only matches between those teams and re-rank the run. Rows in
 *  groups of size 1 are left untouched. */
function applyHeadToHeadTiebreaker(
  sorted: StandingRow[],
  allMatches: Match[],
  scoring: ScoringRule
): StandingRow[] {
  const result = [...sorted];
  let i = 0;
  while (i < result.length) {
    let j = i;
    while (j + 1 < result.length && result[j + 1].points === result[i].points) {
      j++;
    }
    const groupSize = j - i + 1;
    if (groupSize > 1) {
      const tiedIds = new Set<number>();
      const tiedParticipants: Participant[] = [];
      for (let k = i; k <= j; k++) {
        const row = result[k];
        tiedIds.add(row.participantId);
        tiedParticipants.push({
          id: row.participantId,
          tournamentId: 0,
          name: row.name,
          seed: null,
          icon: null,
          iconColor: null,
        });
      }
      const h2hMatches = allMatches.filter(
        (m) =>
          m.participantAId != null &&
          m.participantBId != null &&
          tiedIds.has(m.participantAId) &&
          tiedIds.has(m.participantBId)
      );
      if (h2hMatches.length > 0) {
        const miniRows = accumulateStats(h2hMatches, tiedParticipants, scoring);
        const miniSorted = sortByOverall(miniRows);
        const rank = new Map<number, number>();
        miniSorted.forEach((r, idx) => rank.set(r.participantId, idx));
        const tied = result.slice(i, j + 1);
        // Re-sort the tied group by mini-rank; rows with the same mini-rank
        // (i.e. still tied even after H2H) keep their incoming order, which
        // is the overall-tiebreaker order from sortByOverall.
        tied.sort((a, b) => {
          const ra = rank.get(a.participantId) ?? 0;
          const rb = rank.get(b.participantId) ?? 0;
          return ra - rb;
        });
        for (let k = 0; k < tied.length; k++) {
          result[i + k] = tied[k];
        }
      }
    }
    i = j + 1;
  }
  return result;
}
