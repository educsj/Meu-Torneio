import { describe, expect, it } from 'vitest';

import type { CustomPhaseInput } from '@/types/tournament';

import { validateCustomPhases } from './customPhaseValidation';

function rr(overrides: Partial<CustomPhaseInput> = {}): CustomPhaseInput {
  return {
    name: 'Liga',
    format: 'round_robin',
    legs: 1,
    groupCount: 1,
    qualifiers: null,
    scoring: 'fifa',
    thirdPlace: false,
    ...overrides,
  };
}
function se(overrides: Partial<CustomPhaseInput> = {}): CustomPhaseInput {
  return {
    name: 'Mata-mata',
    format: 'single_elimination',
    legs: 1,
    groupCount: 1,
    qualifiers: null,
    scoring: 'fifa',
    thirdPlace: false,
    ...overrides,
  };
}
function pp(overrides: Partial<CustomPhaseInput> = {}): CustomPhaseInput {
  return {
    name: 'Playoffs',
    format: 'placement_playoff',
    legs: 1,
    groupCount: 1,
    qualifiers: null,
    scoring: 'fifa',
    thirdPlace: false,
    ...overrides,
  };
}

describe('validateCustomPhases', () => {
  it('rejects empty phase list', () => {
    expect(validateCustomPhases([])).toEqual([{ code: 'no_phases' }]);
  });

  it('rejects more than 2 phases', () => {
    const phases = [rr({ qualifiers: 4 }), se({ qualifiers: 4 }), pp()];
    expect(validateCustomPhases(phases)).toContainEqual({
      code: 'too_many_phases',
      max: 2,
    });
  });

  it('accepts a single round_robin phase', () => {
    expect(validateCustomPhases([rr()])).toEqual([]);
  });

  it('accepts a single single_elimination phase', () => {
    expect(validateCustomPhases([se()])).toEqual([]);
  });

  it('rejects a last phase with qualifiers set (nothing to qualify for)', () => {
    expect(validateCustomPhases([rr({ qualifiers: 4 })])).toContainEqual({
      code: 'last_phase_has_qualifiers',
      index: 0,
    });
  });

  it('rejects a first phase with no qualifiers when there is a second phase', () => {
    expect(validateCustomPhases([rr(), pp()])).toContainEqual({
      code: 'first_phase_no_qualifiers',
      index: 0,
    });
  });

  it('rejects round_robin as the SECOND phase (no chained leagues yet)', () => {
    expect(
      validateCustomPhases([rr({ qualifiers: 4 }), rr()])
    ).toContainEqual({
      code: 'second_phase_must_not_be_round_robin',
      index: 1,
    });
  });

  it('accepts league_playoff equivalent (RR → placement_playoff, qualifiers=4)', () => {
    expect(validateCustomPhases([rr({ qualifiers: 4 }), pp()])).toEqual([]);
  });

  it('accepts groups_knockout equivalent (RR groupCount=2, qualifiers=4 → SE)', () => {
    expect(
      validateCustomPhases([
        rr({ groupCount: 2, qualifiers: 4 }),
        se(),
      ])
    ).toEqual([]);
  });

  it('rejects placement_playoff when qualifiers is odd', () => {
    expect(
      validateCustomPhases([rr({ qualifiers: 3 }), pp()])
    ).toContainEqual({
      code: 'qualifiers_must_be_even',
      index: 0,
      got: 3,
    });
  });

  it('accepts single-league → single_elim with qualifiers ∈ {2,4,8,16}', () => {
    for (const q of [2, 4, 8, 16]) {
      expect(
        validateCustomPhases([rr({ groupCount: 1, qualifiers: q }), se()])
      ).toEqual([]);
    }
  });

  it('rejects non-power-of-two qualifiers feeding single_elim', () => {
    expect(
      validateCustomPhases([rr({ qualifiers: 6 }), se()])
    ).toContainEqual({
      code: 'single_elim_qualifiers_unsupported',
      index: 0,
      got: 6,
    });
  });

  it('rejects qualifiers above 16 for single_elim (UI cap)', () => {
    expect(
      validateCustomPhases([rr({ qualifiers: 32 }), se()])
    ).toContainEqual({
      code: 'single_elim_qualifiers_unsupported',
      index: 0,
      got: 32,
    });
  });

  it('accepts multi-group → single_elim when qualifiers = 2× groups (top-2 each)', () => {
    // 4 groups → top-2 each → 8-team bracket
    expect(
      validateCustomPhases([
        rr({ groupCount: 4, qualifiers: 8 }),
        se(),
      ])
    ).toEqual([]);
    // 8 groups → top-2 each → 16-team bracket
    expect(
      validateCustomPhases([
        rr({ groupCount: 8, qualifiers: 16 }),
        se(),
      ])
    ).toEqual([]);
  });

  it('rejects multi-group → single_elim when qualifiers ≠ 2× groups', () => {
    // 2 groups asking for 8 qualifiers (would mean top-4 of each, no seeder yet)
    expect(
      validateCustomPhases([
        rr({ groupCount: 2, qualifiers: 8 }),
        se(),
      ])
    ).toContainEqual({
      code: 'single_elim_multi_group_unsupported',
      index: 0,
    });
  });

  it('rejects multi-group → single_elim with odd group count (no clean pairing)', () => {
    // 3 groups → 6 qualifiers (top-2 each). qualifiers=6 isn't power of 2,
    // so the first check (qualifiers shape) catches it; the multi-group
    // constraint would also flag it. Either error is acceptable.
    const errors = validateCustomPhases([
      rr({ groupCount: 3, qualifiers: 6 }),
      se(),
    ]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects 3 groups asking for 4 qualifiers (groupCount must be even)', () => {
    expect(
      validateCustomPhases([
        rr({ groupCount: 3, qualifiers: 4 }),
        se(),
      ])
    ).toContainEqual({
      code: 'single_elim_multi_group_unsupported',
      index: 0,
    });
  });

  it('legs=2 home-and-away with playoffs is accepted (the vôlei case)', () => {
    expect(
      validateCustomPhases([rr({ legs: 2, qualifiers: 4 }), pp()])
    ).toEqual([]);
  });
});
