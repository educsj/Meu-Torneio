import { describe, expect, it } from 'vitest';

import type { Match, Participant } from '@/types/tournament';

import { computeStandings, pointsForMatch } from './standings';

function p(id: number, name: string): Participant {
  return { id, tournamentId: 1, name, seed: null, icon: null, iconColor: null };
}

function m(
  id: number,
  a: number,
  b: number,
  scoreA: number | null,
  scoreB: number | null
): Match {
  return {
    id,
    tournamentId: 1,
    round: 1,
    participantAId: a,
    participantBId: b,
    scoreA,
    scoreB,
    winnerId:
      scoreA == null || scoreB == null
        ? null
        : scoreA > scoreB
          ? a
          : scoreA < scoreB
            ? b
            : null,
    nextMatchId: null,
    loserNextMatchId: null,
    nextSlot: null,
    loserNextSlot: null,
    scheduledAt: null,
    location: null,
    groupLabel: null,
    stage: 'main',
    phaseId: null,
    walkover: false,
  };
}

describe('pointsForMatch', () => {
  describe('fifa', () => {
    it('win → 3-0 points', () => {
      expect(pointsForMatch(2, 1, 'fifa')).toMatchObject({
        a: 3,
        b: 0,
        aWin: true,
      });
      expect(pointsForMatch(0, 5, 'fifa')).toMatchObject({
        a: 0,
        b: 3,
        bWin: true,
      });
    });

    it('draw → 1-1 points', () => {
      expect(pointsForMatch(2, 2, 'fifa')).toMatchObject({
        a: 1,
        b: 1,
        draw: true,
      });
    });
  });

  describe('volleyball', () => {
    it('3-0 / 3-1 wins → 3-0 points (margin ≥ 2 sets)', () => {
      expect(pointsForMatch(3, 0, 'volleyball')).toMatchObject({
        a: 3,
        b: 0,
        aWin: true,
      });
      expect(pointsForMatch(3, 1, 'volleyball')).toMatchObject({
        a: 3,
        b: 0,
        aWin: true,
      });
    });

    it('3-2 win → 2-1 points (margin = 1 set)', () => {
      expect(pointsForMatch(3, 2, 'volleyball')).toMatchObject({
        a: 2,
        b: 1,
        aWin: true,
      });
      expect(pointsForMatch(2, 3, 'volleyball')).toMatchObject({
        a: 1,
        b: 2,
        bWin: true,
      });
    });

    it('0-3 / 1-3 losses → 0-3 points (mirror of dominant win)', () => {
      expect(pointsForMatch(0, 3, 'volleyball')).toMatchObject({
        a: 0,
        b: 3,
        bWin: true,
      });
      expect(pointsForMatch(1, 3, 'volleyball')).toMatchObject({
        a: 0,
        b: 3,
        bWin: true,
      });
    });

    it('defensive: equal scores produce 0-0 (vôlei has no draws)', () => {
      expect(pointsForMatch(2, 2, 'volleyball')).toMatchObject({
        a: 0,
        b: 0,
        draw: true,
      });
    });
  });
});

describe('computeStandings — head-to-head tiebreaker', () => {
  const A = p(1, 'A');
  const B = p(2, 'B');
  const C = p(3, 'C');
  const D = p(4, 'D');

  it('breaks 2-team tie by direct match (A beat B → A above)', () => {
    // Both A and B beat C and D; A beat B head-to-head.
    // Without H2H, both have 9 points and identical GD (B might even
    // have better goalsFor depending on score), but A should rank first.
    const matches: Match[] = [
      m(1, A.id, B.id, 1, 0), // A>B (H2H favors A)
      m(2, A.id, C.id, 2, 0),
      m(3, A.id, D.id, 2, 0),
      m(4, B.id, C.id, 5, 0), // B has higher overall GF
      m(5, B.id, D.id, 5, 0),
      m(6, C.id, D.id, 1, 1),
    ];
    const rows = computeStandings(matches, [A, B, C, D]);
    // A and B both have 9 points. B has better overall GF (10) than A (5).
    // Without H2H, B would rank above A. With H2H, A wins the tie.
    expect(rows[0].participantId).toBe(A.id);
    expect(rows[1].participantId).toBe(B.id);
  });

  it('breaks 3-team tie via mini-table among the tied teams', () => {
    // A, B, C all finish on 6 points (each beats one of the others, loses
    // to one). Mini-table among A/B/C uses only the matches between them.
    // Construct: A beats B 2-0, B beats C 3-0, C beats A 1-0.
    // Plus all three beat D 1-0.
    const matches: Match[] = [
      m(1, A.id, B.id, 2, 0), // A>B (mini A: +2)
      m(2, B.id, C.id, 3, 0), // B>C (mini B: +3)
      m(3, C.id, A.id, 1, 0), // C>A (mini C: +1)
      m(4, A.id, D.id, 1, 0),
      m(5, B.id, D.id, 1, 0),
      m(6, C.id, D.id, 1, 0),
    ];
    const rows = computeStandings(matches, [A, B, C, D]);
    // Each of A/B/C has 6 points overall. Mini-table:
    //   A: 1W 1L, GF=2, GA=1, GD=+1, 3 pts
    //   B: 1W 1L, GF=3, GA=2, GD=+1, 3 pts
    //   C: 1W 1L, GF=1, GA=3, GD=-2, 3 pts
    // Mini-table tiebreakers: pts equal → GD → B (+1, more GF) above A (+1)
    // → C last.
    expect(rows[0].participantId).toBe(B.id);
    expect(rows[1].participantId).toBe(A.id);
    expect(rows[2].participantId).toBe(C.id);
    // D unaffected, last with 0 points
    expect(rows[3].participantId).toBe(D.id);
  });

  it('falls back to overall tiebreakers when H2H is also tied', () => {
    // A and B both 6 pts. They drew their match → mini-table doesn't
    // separate them. Fall through to overall GD: A has +5, B has +3.
    const matches: Match[] = [
      m(1, A.id, B.id, 1, 1), // draw, mini doesn't help
      m(2, A.id, C.id, 5, 0), // A scores big
      m(3, A.id, D.id, 0, 0), // draw
      m(4, B.id, C.id, 3, 0),
      m(5, B.id, D.id, 0, 0),
      m(6, C.id, D.id, 0, 0),
    ];
    const rows = computeStandings(matches, [A, B, C, D]);
    // Both A and B have 5 points (1W + 2D = 5). H2H drawn → fall to
    // overall: A GD=+5, B GD=+3, A goes first.
    expect(rows[0].participantId).toBe(A.id);
    expect(rows[1].participantId).toBe(B.id);
  });

  it('does not reorder rows that are not tied on points', () => {
    const matches: Match[] = [
      m(1, A.id, B.id, 0, 1), // B>A
      m(2, A.id, C.id, 0, 1), // C>A
      m(3, B.id, C.id, 1, 1), // draw
    ];
    const rows = computeStandings(matches, [A, B, C]);
    // B: 4 pts (1W 1D), C: 4 pts (1W 1D), A: 0 pts.
    // B and C are tied; H2H is a draw, so falls to overall GF/GD/name.
    // B vs C: GD same (0/0), GF same (2/2), name asc → B first then C.
    // A goes last.
    expect(rows[2].participantId).toBe(A.id);
  });
});

describe('computeStandings with volleyball scoring', () => {
  const A = { id: 1, tournamentId: 1, name: 'A', seed: null, icon: null, iconColor: null };
  const B = { id: 2, tournamentId: 1, name: 'B', seed: null, icon: null, iconColor: null };

  it('awards 3-0 / 2-1 / 0-3 per match according to set margin', () => {
    // Two matches between A and B: A wins 3-0, then B wins 3-2.
    // FIFA would give A=3, B=3 (3 each from one win). Volleyball gives
    // A=3+1=4 (3-0 win plus 3-2 loss = 1 pt), B=0+2=2.
    const matches: Match[] = [
      {
        id: 1,
        tournamentId: 1,
        round: 1,
        participantAId: A.id,
        participantBId: B.id,
        scoreA: 3,
        scoreB: 0,
        winnerId: A.id,
        nextMatchId: null,
        loserNextMatchId: null,
        nextSlot: null,
        loserNextSlot: null,
        scheduledAt: null,
        location: null,
        groupLabel: null,
        stage: 'main',
        phaseId: null,
        walkover: false,
      },
      {
        id: 2,
        tournamentId: 1,
        round: 2,
        participantAId: A.id,
        participantBId: B.id,
        scoreA: 2,
        scoreB: 3,
        winnerId: B.id,
        nextMatchId: null,
        loserNextMatchId: null,
        nextSlot: null,
        loserNextSlot: null,
        scheduledAt: null,
        location: null,
        groupLabel: null,
        stage: 'main',
        phaseId: null,
        walkover: false,
      },
    ];
    const rows = computeStandings(matches, [A, B], { scoring: 'volleyball' });
    const a = rows.find((r) => r.participantId === A.id)!;
    const b = rows.find((r) => r.participantId === B.id)!;
    expect(a.points).toBe(4); // 3 (3-0 win) + 1 (lost 2-3)
    expect(b.points).toBe(2); // 0 (0-3 loss) + 2 (3-2 win)
    expect(a.wins).toBe(1);
    expect(b.wins).toBe(1);
  });
});

describe('computeStandings', () => {
  const A = p(1, 'A');
  const B = p(2, 'B');
  const C = p(3, 'C');
  const D = p(4, 'D');

  it('returns all participants with zeros when no matches played', () => {
    const rows = computeStandings([], [A, B, C]);
    expect(rows).toHaveLength(3);
    rows.forEach((r) => {
      expect(r).toMatchObject({
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      });
    });
  });

  it('counts wins as 3 points and losses as 0', () => {
    const matches = [m(1, A.id, B.id, 2, 1)];
    const rows = computeStandings(matches, [A, B]);
    const rowA = rows.find((r) => r.participantId === A.id)!;
    const rowB = rows.find((r) => r.participantId === B.id)!;
    expect(rowA).toMatchObject({
      played: 1,
      wins: 1,
      losses: 0,
      points: 3,
      goalsFor: 2,
      goalsAgainst: 1,
      goalDiff: 1,
    });
    expect(rowB).toMatchObject({
      played: 1,
      wins: 0,
      losses: 1,
      points: 0,
      goalsFor: 1,
      goalsAgainst: 2,
      goalDiff: -1,
    });
  });

  it('counts a draw as 1 point each', () => {
    const matches = [m(1, A.id, B.id, 2, 2)];
    const rows = computeStandings(matches, [A, B]);
    rows.forEach((r) => {
      expect(r.points).toBe(1);
      expect(r.draws).toBe(1);
      expect(r.goalsFor).toBe(2);
      expect(r.goalsAgainst).toBe(2);
      expect(r.goalDiff).toBe(0);
    });
  });

  it('skips matches with missing participants or scores', () => {
    const partial: Match[] = [
      m(1, A.id, B.id, null, null),
      { ...m(2, A.id, B.id, 1, 0), participantBId: null },
    ];
    const rows = computeStandings(partial, [A, B]);
    rows.forEach((r) => expect(r.played).toBe(0));
  });

  it('orders by points desc, then goal diff, then goals for, then name', () => {
    // A: 1 win 3-0 vs D       → 3 pts, GD +3
    // B: 1 draw 1-1 vs C      → 1 pt,  GD  0
    // C: draw 1-1 + win 2-0   → 4 pts, GD +2
    // D: 0-3 + 0-2            → 0 pts, GD -5
    const matches = [
      m(1, A.id, D.id, 3, 0),
      m(2, B.id, C.id, 1, 1),
      m(3, C.id, D.id, 2, 0),
    ];
    const rows = computeStandings(matches, [A, B, C, D]);
    expect(rows.map((r) => r.name)).toEqual(['C', 'A', 'B', 'D']);
  });

  it('breaks ties on goal diff before goals for', () => {
    // A and B both have 3 points
    // A: 2-0 (GD +2, GF 2)
    // B: 5-2 (GD +3, GF 5)  ← B should rank higher (better GD)
    const X = p(5, 'X');
    const matches = [m(1, A.id, X.id, 2, 0), m(2, B.id, X.id, 5, 2)];
    const rows = computeStandings(matches, [A, B, X]);
    expect(rows[0].name).toBe('B');
    expect(rows[1].name).toBe('A');
  });

  it('breaks GD ties on goals for', () => {
    // A and B both 3 pts and GD +1
    // A 2-1, B 1-0 → A has more GF
    const matches = [m(1, A.id, C.id, 2, 1), m(2, B.id, D.id, 1, 0)];
    const rows = computeStandings(matches, [A, B, C, D]);
    expect(rows[0].name).toBe('A');
    expect(rows[1].name).toBe('B');
  });

  it('breaks all-numeric ties alphabetically by name', () => {
    // Both end with same points/GD/GF
    const matches = [m(1, A.id, B.id, 0, 0)];
    const rows = computeStandings(matches, [A, B]);
    expect(rows[0].name).toBe('A'); // A < B alphabetically
  });
});
