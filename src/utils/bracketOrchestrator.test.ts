import { describe, expect, it } from 'vitest';

import type { Participant, Phase } from '@/types/tournament';

import {
  computeMinParticipantsForPhases,
  generateBracketFromPhases,
} from './bracketOrchestrator';

function makeParticipants(n: number): Participant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    tournamentId: 1,
    name: `P${i + 1}`,
    seed: i + 1,
    icon: null,
    iconColor: null,
  }));
}

function phase(overrides: Partial<Phase> & Pick<Phase, 'format'>): Phase {
  return {
    id: 1,
    tournamentId: 1,
    ordinal: 0,
    name: 'Phase',
    legs: 1,
    groupCount: 1,
    qualifiers: null,
    status: 'pending',
    scoring: 'fifa',
    tiebreaker: 'fifa',
    thirdPlace: false,
    bracketReset: false,
    ...overrides,
  };
}

// Phase shapes mirror defaultPhasesForType — these tests pin them down so a
// bug in either the orchestrator OR the preset definition would surface.
const SINGLE_ELIM_PRESET: Phase[] = [phase({ format: 'single_elimination' })];

const ROUND_ROBIN_PRESET: Phase[] = [phase({ format: 'round_robin' })];

const GROUPS_KNOCKOUT_PRESET: Phase[] = [
  phase({
    id: 1,
    ordinal: 0,
    format: 'round_robin',
    groupCount: 2,
    qualifiers: 4,
  }),
  phase({
    id: 2,
    ordinal: 1,
    format: 'single_elimination',
  }),
];

const LEAGUE_PLAYOFF_PRESET: Phase[] = [
  phase({
    id: 1,
    ordinal: 0,
    format: 'round_robin',
    legs: 2,
    qualifiers: 4,
  }),
  phase({
    id: 2,
    ordinal: 1,
    format: 'placement_playoff',
  }),
];

describe('generateBracketFromPhases', () => {
  it('throws when no phases are configured', () => {
    expect(() =>
      generateBracketFromPhases([], makeParticipants(4))
    ).toThrow();
  });

  describe('single_elimination preset (single phase)', () => {
    it('all matches stage=main; matches the legacy SE bracket shape (4 teams)', () => {
      const matches = generateBracketFromPhases(
        SINGLE_ELIM_PRESET,
        makeParticipants(4)
      );
      expect(matches).toHaveLength(3); // 2 R1 + 1 final
      matches.forEach((m) => expect(m.stage).toBe('main'));
      const r1 = matches.filter((m) => m.round === 1);
      const r2 = matches.filter((m) => m.round === 2);
      expect(r1).toHaveLength(2);
      expect(r2).toHaveLength(1);
      // Standard 4-bracket: 1v4, 2v3
      expect(r1[0]).toMatchObject({ participantAId: 1, participantBId: 4 });
      expect(r1[1]).toMatchObject({ participantAId: 2, participantBId: 3 });
    });
  });

  describe('round_robin preset (single phase)', () => {
    it('all matches stage=main; N*(N-1)/2 pairings across N-1 rounds', () => {
      const matches = generateBracketFromPhases(
        ROUND_ROBIN_PRESET,
        makeParticipants(4)
      );
      expect(matches).toHaveLength(6); // C(4,2)
      matches.forEach((m) => expect(m.stage).toBe('main'));
      // Circle method: 4 teams → 3 rounds × 2 parallel matches per round.
      const rounds = new Set(matches.map((m) => m.round));
      expect(rounds.size).toBe(3);
    });
  });

  describe('groups_knockout preset (2 phases)', () => {
    it('group phase: stage=group, multi-group with labels A/B', () => {
      const matches = generateBracketFromPhases(
        GROUPS_KNOCKOUT_PRESET,
        makeParticipants(8)
      );
      const group = matches.filter((m) => m.stage === 'group');
      // 2 groups of 4 → C(4,2) * 2 = 12
      expect(group).toHaveLength(12);
      const labels = new Set(group.map((m) => m.groupLabel));
      expect(labels).toEqual(new Set(['A', 'B']));
    });

    it('knockout phase: 2 semis + 1 final, all empty placeholders', () => {
      const matches = generateBracketFromPhases(
        GROUPS_KNOCKOUT_PRESET,
        makeParticipants(8)
      );
      const knockout = matches.filter((m) => m.stage === 'knockout');
      expect(knockout).toHaveLength(3);
      const semis = knockout.filter((m) => m.round === 1);
      const final = knockout.filter((m) => m.round === 2);
      expect(semis).toHaveLength(2);
      expect(final).toHaveLength(1);
      knockout.forEach((m) => {
        expect(m.participantAId).toBeNull();
        expect(m.participantBId).toBeNull();
      });
    });
  });

  describe('league_playoff preset (2 phases)', () => {
    it('league phase: legs=2 single-group RR with stage=group, no labels', () => {
      const matches = generateBracketFromPhases(
        LEAGUE_PLAYOFF_PRESET,
        makeParticipants(4)
      );
      const league = matches.filter((m) => m.stage === 'group');
      // C(4,2) * 2 = 12 matches (ida + volta), distributed over 6 rounds:
      // leg 1 → rounds 1..3, leg 2 → rounds 4..6.
      expect(league).toHaveLength(12);
      league.forEach((m) => expect(m.groupLabel).toBeNull());
      const ida = league.filter((m) => m.round <= 3);
      const volta = league.filter((m) => m.round >= 4);
      expect(ida).toHaveLength(6);
      expect(volta).toHaveLength(6);
    });

    it('playoff phase: 2 parallel placement matches, stage=knockout', () => {
      const matches = generateBracketFromPhases(
        LEAGUE_PLAYOFF_PRESET,
        makeParticipants(4)
      );
      const playoff = matches.filter((m) => m.stage === 'knockout');
      expect(playoff).toHaveLength(2);
      playoff.forEach((m) => {
        expect(m.round).toBe(1);
        expect(m.nextRoundIndex).toBeNull();
        expect(m.participantAId).toBeNull();
        expect(m.participantBId).toBeNull();
      });
    });
  });

  describe('cross-cutting', () => {
    it('multi-phase always tags first phase=group, later phases=knockout', () => {
      const matches = generateBracketFromPhases(
        GROUPS_KNOCKOUT_PRESET,
        makeParticipants(8)
      );
      const stages = new Set(matches.map((m) => m.stage));
      // No 'main' should appear in a multi-phase tournament.
      expect(stages.has('main')).toBe(false);
      expect(stages.has('group')).toBe(true);
      expect(stages.has('knockout')).toBe(true);
    });

    it('single-phase tags everything as main even when format is round_robin', () => {
      const matches = generateBracketFromPhases(
        ROUND_ROBIN_PRESET,
        makeParticipants(4)
      );
      matches.forEach((m) => expect(m.stage).toBe('main'));
    });
  });
});

describe('computeMinParticipantsForPhases', () => {
  it('returns 2 for empty phases (defensive)', () => {
    expect(computeMinParticipantsForPhases([])).toBe(2);
  });

  it('matches the legacy minimums for each preset', () => {
    expect(computeMinParticipantsForPhases(SINGLE_ELIM_PRESET)).toBe(2);
    expect(computeMinParticipantsForPhases(ROUND_ROBIN_PRESET)).toBe(2);
    expect(computeMinParticipantsForPhases(GROUPS_KNOCKOUT_PRESET)).toBe(4);
    expect(computeMinParticipantsForPhases(LEAGUE_PLAYOFF_PRESET)).toBe(4);
  });

  it('respects multi-group minimums (groupCount * 2)', () => {
    const fourGroups: Phase[] = [
      phase({
        format: 'round_robin',
        groupCount: 4,
        qualifiers: null,
      }),
    ];
    expect(computeMinParticipantsForPhases(fourGroups)).toBe(8);
  });

  it('takes max of format minimum and downstream qualifiers', () => {
    // Single-group league that must produce 8 qualifiers for the next phase
    // → 8 participants minimum, even though a 1-group RR alone needs only 2.
    const big: Phase[] = [
      phase({
        format: 'round_robin',
        groupCount: 1,
        qualifiers: 8,
      }),
    ];
    expect(computeMinParticipantsForPhases(big)).toBe(8);
  });
});
