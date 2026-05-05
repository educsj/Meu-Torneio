import type { Match, Participant } from '@/types/tournament';

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

/**
 * Compute a standings table from a list of matches and participants.
 *
 * Scoring rule (FIFA-style):
 *  - Win  → 3 points
 *  - Draw → 1 point each
 *  - Loss → 0 points
 *
 * Tiebreakers (in order): points desc, goal diff desc, goals for desc,
 * head-to-head wins (best vs the tied opponent), then name asc.
 */
export function computeStandings(
  matches: Match[],
  participants: Participant[]
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

    if (m.scoreA > m.scoreB) {
      rowA.wins++;
      rowA.points += 3;
      rowB.losses++;
    } else if (m.scoreA < m.scoreB) {
      rowB.wins++;
      rowB.points += 3;
      rowA.losses++;
    } else {
      rowA.draws++;
      rowB.draws++;
      rowA.points++;
      rowB.points++;
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
