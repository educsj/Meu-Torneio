import { describe, expect, it } from 'vitest';

import type { Match, Participant } from '@/types/tournament';

import { computeStandings, pointsForMatch } from './standings';

function p(id: number, name: string): Participant {
  return { id, tournamentId: 1, name, seed: null };
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

describe('computeStandings with volleyball scoring', () => {
  const A = { id: 1, tournamentId: 1, name: 'A', seed: null };
  const B = { id: 2, tournamentId: 1, name: 'B', seed: null };

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
