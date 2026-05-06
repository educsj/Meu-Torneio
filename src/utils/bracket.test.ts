import { describe, expect, it } from 'vitest';

import type { Participant } from '@/types/tournament';

import {
  bracketSeedOrder,
  generateDoubleEliminationBracket,
  generateGroupStageMatches,
  generateGroupsKnockoutPlaceholders,
  generatePlacementPlayoffPlaceholders,
  generateRoundRobinMatches,
  generateSingleEliminationBracket,
  generateSingleEliminationPlaceholders,
  GRAND_FINAL_LABEL,
  LOSERS_BRACKET_LABEL,
  nextPowerOfTwo,
  splitIntoGroups,
  THIRD_PLACE_LABEL,
  WINNERS_BRACKET_LABEL,
} from './bracket';

function makeParticipants(n: number): Participant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    tournamentId: 1,
    name: `P${i + 1}`,
    seed: i + 1,
  }));
}

describe('nextPowerOfTwo', () => {
  it('returns the same value for exact powers of two', () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(4)).toBe(4);
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(nextPowerOfTwo(16)).toBe(16);
  });

  it('rounds up to the next power of two', () => {
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(6)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
    expect(nextPowerOfTwo(17)).toBe(32);
  });
});

describe('bracketSeedOrder', () => {
  it('returns canonical NCAA-style bracket positions', () => {
    expect(bracketSeedOrder(2)).toEqual([1, 2]);
    expect(bracketSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(bracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('throws for invalid sizes', () => {
    expect(() => bracketSeedOrder(0)).toThrow();
    expect(() => bracketSeedOrder(3)).toThrow();
    expect(() => bracketSeedOrder(5)).toThrow();
  });

  it('size-16 first half mirrors size-8 with offset', () => {
    const order = bracketSeedOrder(16);
    expect(order).toHaveLength(16);
    // top seeds always end up in opposite halves (1 first, 2 last quadrant)
    expect(order[0]).toBe(1);
    expect(order[order.length - 1]).toBe(11);
  });
});

describe('generateSingleEliminationBracket', () => {
  it('throws with fewer than 2 participants', () => {
    expect(() => generateSingleEliminationBracket([])).toThrow();
    expect(() => generateSingleEliminationBracket(makeParticipants(1))).toThrow();
  });

  it('builds a 2-player bracket with one match and no next round', () => {
    const matches = generateSingleEliminationBracket(makeParticipants(2));
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      round: 1,
      indexInRound: 0,
      participantAId: 1,
      participantBId: 2,
      winnerId: null,
      nextRoundIndex: null,
    });
  });

  it('builds a 4-player bracket: 2 first-round matches + 1 final', () => {
    const matches = generateSingleEliminationBracket(makeParticipants(4));
    expect(matches).toHaveLength(3);
    const r1 = matches.filter((m) => m.round === 1);
    const r2 = matches.filter((m) => m.round === 2);
    expect(r1).toHaveLength(2);
    expect(r2).toHaveLength(1);
    // Standard 4-bracket: 1v4 then 2v3
    expect(r1[0]).toMatchObject({ participantAId: 1, participantBId: 4 });
    expect(r1[1]).toMatchObject({ participantAId: 2, participantBId: 3 });
    expect(r2[0]).toMatchObject({
      participantAId: null,
      participantBId: null,
      nextRoundIndex: null,
    });
  });

  it('handles 6 participants with 2 BYEs auto-resolved on top seeds', () => {
    const matches = generateSingleEliminationBracket(makeParticipants(6));
    expect(matches).toHaveLength(7); // 4 + 2 + 1
    const r1 = matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(4);

    // 2 top seeds get BYE matches (auto-winner)
    const byeMatches = r1.filter((m) => m.winnerId !== null);
    expect(byeMatches).toHaveLength(2);
    expect(byeMatches.map((m) => m.winnerId).sort()).toEqual([1, 2]);

    // 2 real matches (no winner, both sides set)
    const realMatches = r1.filter((m) => m.winnerId === null);
    expect(realMatches).toHaveLength(2);
    realMatches.forEach((m) => {
      expect(m.participantAId).not.toBeNull();
      expect(m.participantBId).not.toBeNull();
    });
  });

  it('builds 8-player bracket with 3 rounds (8/4/2 → wait, 4/2/1)', () => {
    const matches = generateSingleEliminationBracket(makeParticipants(8));
    const counts: Record<number, number> = {};
    for (const m of matches) {
      counts[m.round] = (counts[m.round] ?? 0) + 1;
    }
    expect(counts).toEqual({ 1: 4, 2: 2, 3: 1 });
    // No BYEs in a power-of-two bracket
    expect(matches.filter((m) => m.winnerId !== null)).toHaveLength(0);
  });

  it('links each match to the correct next-round index', () => {
    const matches = generateSingleEliminationBracket(makeParticipants(8));
    const r1 = matches.filter((m) => m.round === 1);
    expect(r1[0].nextRoundIndex).toBe(0);
    expect(r1[1].nextRoundIndex).toBe(0);
    expect(r1[2].nextRoundIndex).toBe(1);
    expect(r1[3].nextRoundIndex).toBe(1);
    const r2 = matches.filter((m) => m.round === 2);
    expect(r2[0].nextRoundIndex).toBe(0);
    expect(r2[1].nextRoundIndex).toBe(0);
    const r3 = matches.filter((m) => m.round === 3);
    expect(r3[0].nextRoundIndex).toBeNull();
  });

  it('respects participant seeds when sorting', () => {
    const ps: Participant[] = [
      { id: 10, tournamentId: 1, name: 'A', seed: 4 },
      { id: 20, tournamentId: 1, name: 'B', seed: 1 },
      { id: 30, tournamentId: 1, name: 'C', seed: 3 },
      { id: 40, tournamentId: 1, name: 'D', seed: 2 },
    ];
    const matches = generateSingleEliminationBracket(ps);
    const r1 = matches.filter((m) => m.round === 1);
    // seed 1 (id=20) vs seed 4 (id=10), seed 2 (id=40) vs seed 3 (id=30)
    expect(r1[0]).toMatchObject({ participantAId: 20, participantBId: 10 });
    expect(r1[1]).toMatchObject({ participantAId: 40, participantBId: 30 });
  });
});

describe('generateRoundRobinMatches', () => {
  it('throws with fewer than 2 participants', () => {
    expect(() => generateRoundRobinMatches([])).toThrow();
    expect(() => generateRoundRobinMatches(makeParticipants(1))).toThrow();
  });

  it('produces N*(N-1)/2 matches', () => {
    expect(generateRoundRobinMatches(makeParticipants(2))).toHaveLength(1);
    expect(generateRoundRobinMatches(makeParticipants(3))).toHaveLength(3);
    expect(generateRoundRobinMatches(makeParticipants(4))).toHaveLength(6);
    expect(generateRoundRobinMatches(makeParticipants(6))).toHaveLength(15);
    expect(generateRoundRobinMatches(makeParticipants(8))).toHaveLength(28);
  });

  it('all pairings are unique and unordered', () => {
    const matches = generateRoundRobinMatches(makeParticipants(5));
    const pairs = new Set(
      matches.map((m) => {
        const [a, b] = [m.participantAId!, m.participantBId!].sort();
        return `${a}-${b}`;
      })
    );
    expect(pairs.size).toBe(matches.length); // no duplicates
    expect(pairs.size).toBe(10); // C(5,2)
  });

  it('every participant plays N-1 matches', () => {
    const ps = makeParticipants(5);
    const matches = generateRoundRobinMatches(ps);
    for (const p of ps) {
      const count = matches.filter(
        (m) => m.participantAId === p.id || m.participantBId === p.id
      ).length;
      expect(count).toBe(4);
    }
  });

  it('schedules into N-1 parallel rounds for even N', () => {
    const matches = generateRoundRobinMatches(makeParticipants(4));
    const rounds = new Set(matches.map((m) => m.round));
    expect(rounds.size).toBe(3); // 4-1
    // Each round has N/2 = 2 simultaneous matches.
    for (const r of rounds) {
      const inRound = matches.filter((m) => m.round === r);
      expect(inRound).toHaveLength(2);
    }
  });

  it('no participant plays twice in the same round', () => {
    const matches = generateRoundRobinMatches(makeParticipants(6));
    const byRound = new Map<number, number[]>();
    for (const m of matches) {
      const arr = byRound.get(m.round) ?? [];
      arr.push(m.participantAId!, m.participantBId!);
      byRound.set(m.round, arr);
    }
    for (const ids of byRound.values()) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('handles odd N by giving exactly one bye per round', () => {
    // 5 teams: 5 rounds, 2 matches per round (one team byes each round)
    const matches = generateRoundRobinMatches(makeParticipants(5));
    expect(matches).toHaveLength(10); // C(5,2)
    const rounds = new Set(matches.map((m) => m.round));
    expect(rounds.size).toBe(5);
    for (const r of rounds) {
      const inRound = matches.filter((m) => m.round === r);
      expect(inRound).toHaveLength(2);
    }
  });

  it('matches have no next-round links and no preset winner', () => {
    const matches = generateRoundRobinMatches(makeParticipants(4));
    matches.forEach((m) => {
      expect(m.nextRoundIndex).toBeNull();
      expect(m.winnerId).toBeNull();
    });
  });
});

describe('splitIntoGroups (snake seeding)', () => {
  it('splits 6 into 2 balanced groups via snake order (1,4,5 / 2,3,6)', () => {
    const ps = makeParticipants(6);
    const groups = splitIntoGroups(ps, 2);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((p) => p.seed)).toEqual([1, 4, 5]);
    expect(groups[1].map((p) => p.seed)).toEqual([2, 3, 6]);
  });

  it('splits 8 into 2 groups (1,4,5,8 / 2,3,6,7)', () => {
    const groups = splitIntoGroups(makeParticipants(8), 2);
    expect(groups[0].map((p) => p.seed)).toEqual([1, 4, 5, 8]);
    expect(groups[1].map((p) => p.seed)).toEqual([2, 3, 6, 7]);
  });

  it('splits 9 into 3 groups (1,6,7 / 2,5,8 / 3,4,9)', () => {
    const groups = splitIntoGroups(makeParticipants(9), 3);
    expect(groups[0].map((p) => p.seed)).toEqual([1, 6, 7]);
    expect(groups[1].map((p) => p.seed)).toEqual([2, 5, 8]);
    expect(groups[2].map((p) => p.seed)).toEqual([3, 4, 9]);
  });

  it('every participant appears exactly once', () => {
    const ps = makeParticipants(7);
    const groups = splitIntoGroups(ps, 2);
    const flat = groups.flat();
    expect(flat).toHaveLength(7);
    expect(new Set(flat.map((p) => p.id)).size).toBe(7);
  });
});

describe('generateGroupStageMatches', () => {
  it('throws when there are not enough participants per group', () => {
    expect(() => generateGroupStageMatches(makeParticipants(3), 2)).toThrow();
  });

  it('produces N choose 2 matches per group', () => {
    // 6 participants, 2 groups of 3 → C(3,2)*2 = 6 matches
    const matches = generateGroupStageMatches(makeParticipants(6), 2);
    expect(matches).toHaveLength(6);
    const groupAMatches = matches.filter((m) => m.groupLabel === 'A');
    const groupBMatches = matches.filter((m) => m.groupLabel === 'B');
    expect(groupAMatches).toHaveLength(3);
    expect(groupBMatches).toHaveLength(3);
  });

  it('all matches are tagged with stage=group and a group label', () => {
    const matches = generateGroupStageMatches(makeParticipants(8), 2);
    matches.forEach((m) => {
      expect(m.stage).toBe('group');
      expect(m.groupLabel).toMatch(/^[A-Z]$/);
    });
  });

  it('participants in different groups never play each other', () => {
    const matches = generateGroupStageMatches(makeParticipants(8), 2);
    const groupOf = new Map<number, string>();
    for (const m of matches) {
      groupOf.set(m.participantAId!, m.groupLabel!);
      groupOf.set(m.participantBId!, m.groupLabel!);
    }
    matches.forEach((m) => {
      expect(groupOf.get(m.participantAId!)).toBe(m.groupLabel);
      expect(groupOf.get(m.participantBId!)).toBe(m.groupLabel);
    });
  });
});

describe('generateRoundRobinMatches with legs=2 (home and away)', () => {
  it('produces twice as many matches as legs=1', () => {
    const ps = makeParticipants(4);
    const single = generateRoundRobinMatches(ps);
    const double = generateRoundRobinMatches(ps, { legs: 2 });
    expect(single).toHaveLength(6); // C(4,2)
    expect(double).toHaveLength(12); // C(4,2)*2
  });

  it('second leg reverses home/away of every pairing', () => {
    const ps = makeParticipants(4);
    const matches = generateRoundRobinMatches(ps, { legs: 2 });
    // For N=4: leg 1 → rounds 1..3 (3 rounds × 2 matches = 6); leg 2 → 4..6.
    const ida = matches.filter((m) => m.round <= 3);
    const volta = matches.filter((m) => m.round >= 4);
    expect(ida).toHaveLength(6);
    expect(volta).toHaveLength(6);
    // For each ida pairing (a,b), the volta pairing (b,a) must exist.
    for (const m of ida) {
      const reversed = volta.find(
        (v) =>
          v.participantAId === m.participantBId &&
          v.participantBId === m.participantAId
      );
      expect(reversed).toBeDefined();
    }
  });

  it('every participant plays 2*(N-1) matches over both legs', () => {
    const ps = makeParticipants(5);
    const matches = generateRoundRobinMatches(ps, { legs: 2 });
    for (const p of ps) {
      const count = matches.filter(
        (m) => m.participantAId === p.id || m.participantBId === p.id
      ).length;
      expect(count).toBe(8); // 2*(5-1)
    }
  });
});

describe('generatePlacementPlayoffPlaceholders', () => {
  it('produces spots/2 empty parallel matches with stage=knockout', () => {
    const matches = generatePlacementPlayoffPlaceholders(4);
    expect(matches).toHaveLength(2);
    matches.forEach((m) => {
      expect(m.stage).toBe('knockout');
      expect(m.participantAId).toBeNull();
      expect(m.participantBId).toBeNull();
      expect(m.round).toBe(1);
      // No bracket tree — all are leaf matches.
      expect(m.nextRoundIndex).toBeNull();
    });
  });

  it('rejects odd or zero/negative spots', () => {
    expect(() => generatePlacementPlayoffPlaceholders(0)).toThrow();
    expect(() => generatePlacementPlayoffPlaceholders(1)).toThrow();
    expect(() => generatePlacementPlayoffPlaceholders(3)).toThrow();
    expect(() => generatePlacementPlayoffPlaceholders(5)).toThrow();
  });

  it('scales: 8 spots → 4 placement matches', () => {
    expect(generatePlacementPlayoffPlaceholders(8)).toHaveLength(4);
  });
});

describe('generateSingleEliminationPlaceholders', () => {
  it('throws on non-power-of-two qualifiers', () => {
    expect(() => generateSingleEliminationPlaceholders(0)).toThrow();
    expect(() => generateSingleEliminationPlaceholders(1)).toThrow();
    expect(() => generateSingleEliminationPlaceholders(3)).toThrow();
    expect(() => generateSingleEliminationPlaceholders(6)).toThrow();
    expect(() => generateSingleEliminationPlaceholders(10)).toThrow();
  });

  it('K=2 → 1 final placeholder, no next-round link', () => {
    const ms = generateSingleEliminationPlaceholders(2);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({
      round: 1,
      indexInRound: 0,
      participantAId: null,
      participantBId: null,
      nextRoundIndex: null,
      stage: 'knockout',
    });
  });

  it('K=8 → 4 + 2 + 1 with proper next-round links', () => {
    const ms = generateSingleEliminationPlaceholders(8);
    const r1 = ms.filter((m) => m.round === 1);
    const r2 = ms.filter((m) => m.round === 2);
    const r3 = ms.filter((m) => m.round === 3);
    expect(r1).toHaveLength(4);
    expect(r2).toHaveLength(2);
    expect(r3).toHaveLength(1);
    // r1[0] and r1[1] feed r2[0]; r1[2] and r1[3] feed r2[1]; both r2 feed r3.
    expect(r1[0].nextRoundIndex).toBe(0);
    expect(r1[1].nextRoundIndex).toBe(0);
    expect(r1[2].nextRoundIndex).toBe(1);
    expect(r1[3].nextRoundIndex).toBe(1);
    expect(r2[0].nextRoundIndex).toBe(0);
    expect(r2[1].nextRoundIndex).toBe(0);
    expect(r3[0].nextRoundIndex).toBeNull();
  });

  it('K=16 → totals 8/4/2/1', () => {
    const ms = generateSingleEliminationPlaceholders(16);
    const counts: Record<number, number> = {};
    for (const m of ms) counts[m.round] = (counts[m.round] ?? 0) + 1;
    expect(counts).toEqual({ 1: 8, 2: 4, 3: 2, 4: 1 });
    ms.forEach((m) => expect(m.stage).toBe('knockout'));
  });
});

describe('thirdPlace option', () => {
  it('appends a 3rd-place placeholder to a 4-team SE bracket placeholder', () => {
    const matches = generateSingleEliminationPlaceholders(4, {
      thirdPlace: true,
    });
    // 2 semis + 1 final + 1 third-place = 4 matches total.
    expect(matches).toHaveLength(4);
    const tp = matches.find((m) => m.groupLabel === THIRD_PLACE_LABEL);
    expect(tp).toBeDefined();
    expect(tp!.round).toBe(2); // same round as the final
    expect(tp!.indexInRound).toBe(1);
    expect(tp!.nextRoundIndex).toBeNull();
    expect(tp!.participantAId).toBeNull();
    expect(tp!.participantBId).toBeNull();
  });

  it('appends a 3rd-place placeholder to an 8-team SE bracket placeholder', () => {
    const matches = generateSingleEliminationPlaceholders(8, {
      thirdPlace: true,
    });
    // 4 QFs + 2 SFs + 1 Final + 1 ThirdPlace = 8 matches total.
    expect(matches).toHaveLength(8);
    const tp = matches.find((m) => m.groupLabel === THIRD_PLACE_LABEL);
    expect(tp).toBeDefined();
    expect(tp!.round).toBe(3); // same round as the final
  });

  it('does not append a 3rd-place when qualifiers < 4 (no semifinals)', () => {
    const matches = generateSingleEliminationPlaceholders(2, {
      thirdPlace: true,
    });
    // K=2 → just the final, no semis → no 3rd-place.
    expect(matches).toHaveLength(1);
    expect(matches.find((m) => m.groupLabel === THIRD_PLACE_LABEL)).toBeUndefined();
  });

  it('appends a 3rd-place to a populated single-elim bracket too', () => {
    const matches = generateSingleEliminationBracket(makeParticipants(4), {
      thirdPlace: true,
    });
    // 2 R1 + 1 R2 (final) + 1 ThirdPlace = 4 matches.
    expect(matches).toHaveLength(4);
    const tp = matches.find((m) => m.groupLabel === THIRD_PLACE_LABEL);
    expect(tp).toBeDefined();
    // Starts empty — slots get filled when the semifinals are played.
    expect(tp!.participantAId).toBeNull();
    expect(tp!.participantBId).toBeNull();
  });

  it('does not append a 3rd-place when option is omitted (default off)', () => {
    const matches = generateSingleEliminationPlaceholders(4);
    expect(matches.find((m) => m.groupLabel === THIRD_PLACE_LABEL)).toBeUndefined();
  });
});

describe('generateDoubleEliminationBracket', () => {
  it('rejects fewer than 4 participants', () => {
    expect(() =>
      generateDoubleEliminationBracket(makeParticipants(2))
    ).toThrow(/at least 4/);
  });

  it('rejects non-power-of-two counts', () => {
    expect(() =>
      generateDoubleEliminationBracket(makeParticipants(6))
    ).toThrow(/power-of-two/);
  });

  it('caps participant count at 16', () => {
    expect(() =>
      generateDoubleEliminationBracket(makeParticipants(32))
    ).toThrow(/capped at 16/);
  });

  it('generates 6 matches for a 4-team bracket (3 WB + 2 LB + 1 GF)', () => {
    const ms = generateDoubleEliminationBracket(makeParticipants(4));
    expect(ms).toHaveLength(6);
    const wb = ms.filter((m) => m.groupLabel === WINNERS_BRACKET_LABEL);
    const lb = ms.filter((m) => m.groupLabel === LOSERS_BRACKET_LABEL);
    const gf = ms.filter((m) => m.groupLabel === GRAND_FINAL_LABEL);
    expect(wb).toHaveLength(3);
    expect(lb).toHaveLength(2);
    expect(gf).toHaveLength(1);
  });

  it('generates 14 matches for an 8-team bracket (7 WB + 6 LB + 1 GF)', () => {
    const ms = generateDoubleEliminationBracket(makeParticipants(8));
    expect(ms).toHaveLength(14);
    const wb = ms.filter((m) => m.groupLabel === WINNERS_BRACKET_LABEL);
    const lb = ms.filter((m) => m.groupLabel === LOSERS_BRACKET_LABEL);
    const gf = ms.filter((m) => m.groupLabel === GRAND_FINAL_LABEL);
    expect(wb).toHaveLength(7);
    expect(lb).toHaveLength(6);
    expect(gf).toHaveLength(1);
  });

  it('generates 30 matches for a 16-team bracket (15 WB + 14 LB + 1 GF)', () => {
    const ms = generateDoubleEliminationBracket(makeParticipants(16));
    expect(ms).toHaveLength(30);
    const wb = ms.filter((m) => m.groupLabel === WINNERS_BRACKET_LABEL);
    const lb = ms.filter((m) => m.groupLabel === LOSERS_BRACKET_LABEL);
    expect(wb).toHaveLength(15);
    expect(lb).toHaveLength(14);
  });

  it('seeds WB-R1 actual participants and leaves later rounds empty', () => {
    const ms = generateDoubleEliminationBracket(makeParticipants(4));
    const wbR1 = ms.filter(
      (m) => m.groupLabel === WINNERS_BRACKET_LABEL && m.round === 1
    );
    expect(wbR1).toHaveLength(2);
    for (const m of wbR1) {
      expect(m.participantAId).not.toBeNull();
      expect(m.participantBId).not.toBeNull();
    }
    // WB-Final and LB matches start empty.
    const wbFinal = ms.find(
      (m) => m.groupLabel === WINNERS_BRACKET_LABEL && m.round === 2
    )!;
    expect(wbFinal.participantAId).toBeNull();
    expect(wbFinal.participantBId).toBeNull();
  });

  it('wires WB-R1 losers to LB-R1 with adjacent slot routing', () => {
    const ms = generateDoubleEliminationBracket(makeParticipants(4));
    const wbR1 = ms
      .filter((m) => m.groupLabel === WINNERS_BRACKET_LABEL && m.round === 1)
      .sort((a, b) => a.indexInRound - b.indexInRound);
    // Both WB-R1 losers feed the same LB-R1 match (indexInRound=0), with
    // M0 → slot A and M1 → slot B.
    expect(wbR1[0].loserDestGroup).toBe(LOSERS_BRACKET_LABEL);
    expect(wbR1[0].loserDestRound).toBe(1);
    expect(wbR1[0].loserDestIndex).toBe(0);
    expect(wbR1[0].loserDestSlot).toBe('A');
    expect(wbR1[1].loserDestSlot).toBe('B');
  });

  it('routes WB-Final winner to GF slot A and LB-Final winner to GF slot B', () => {
    const ms = generateDoubleEliminationBracket(makeParticipants(8));
    const wbFinal = ms.find(
      (m) => m.groupLabel === WINNERS_BRACKET_LABEL && m.round === 3
    )!;
    const lbFinal = ms.find(
      // For 8 teams, LB-Final is the last LB round (= 4).
      (m) => m.groupLabel === LOSERS_BRACKET_LABEL && m.round === 4
    )!;
    expect(wbFinal.winnerDestGroup).toBe(GRAND_FINAL_LABEL);
    expect(wbFinal.winnerDestSlot).toBe('A');
    expect(lbFinal.winnerDestGroup).toBe(GRAND_FINAL_LABEL);
    expect(lbFinal.winnerDestSlot).toBe('B');
  });

  it('routes WB-Final loser to LB-Final', () => {
    const ms = generateDoubleEliminationBracket(makeParticipants(8));
    const wbFinal = ms.find(
      (m) => m.groupLabel === WINNERS_BRACKET_LABEL && m.round === 3
    )!;
    expect(wbFinal.loserDestGroup).toBe(LOSERS_BRACKET_LABEL);
    expect(wbFinal.loserDestRound).toBe(4); // LB-Final round for 8-team
    expect(wbFinal.loserDestIndex).toBe(0);
  });
});

describe('generateGroupsKnockoutPlaceholders', () => {
  it('produces 2 semis + 1 final, all empty, with semi→final links', () => {
    const matches = generateGroupsKnockoutPlaceholders();
    expect(matches).toHaveLength(3);
    const semis = matches.filter((m) => m.round === 1);
    const final = matches.find((m) => m.round === 2);
    expect(semis).toHaveLength(2);
    expect(final).toBeDefined();
    semis.forEach((s) => {
      expect(s.stage).toBe('knockout');
      expect(s.participantAId).toBeNull();
      expect(s.participantBId).toBeNull();
      expect(s.nextRoundIndex).toBe(0);
    });
    expect(final!.stage).toBe('knockout');
    expect(final!.nextRoundIndex).toBeNull();
  });
});
