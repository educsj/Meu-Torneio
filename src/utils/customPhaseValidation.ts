import type { CustomPhaseInput } from '@/types/tournament';

export type ValidationError =
  | { code: 'no_phases' }
  | { code: 'too_many_phases'; max: number }
  | { code: 'last_phase_has_qualifiers'; index: number }
  | { code: 'first_phase_no_qualifiers'; index: number }
  | { code: 'qualifiers_must_be_even'; index: number; got: number }
  | { code: 'single_elim_qualifiers_must_be_4'; index: number; got: number }
  | { code: 'second_phase_must_not_be_round_robin'; index: number };

const MAX_PHASES = 2;

/**
 * Validate a list of CustomPhaseInput against the supported compositions.
 * Returns an empty array on success.
 *
 * Currently we only ship the compositions that map cleanly onto the
 * existing seeding helpers (computeGroupsKnockoutSeeding for SE, and
 * computeLeaguePlayoffSeeding for placement). Other shapes will land as
 * follow-ups; we reject them up front rather than silently mis-seeding.
 */
export function validateCustomPhases(
  phases: CustomPhaseInput[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (phases.length === 0) {
    errors.push({ code: 'no_phases' });
    return errors;
  }
  if (phases.length > MAX_PHASES) {
    errors.push({ code: 'too_many_phases', max: MAX_PHASES });
    return errors;
  }

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const isLast = i === phases.length - 1;

    if (isLast && phase.qualifiers != null) {
      errors.push({ code: 'last_phase_has_qualifiers', index: i });
    }
    if (!isLast && (phase.qualifiers == null || phase.qualifiers <= 0)) {
      errors.push({ code: 'first_phase_no_qualifiers', index: i });
    }
  }

  if (phases.length === 2) {
    const [first, second] = phases;
    const q = first.qualifiers ?? 0;

    if (second.format === 'round_robin') {
      errors.push({
        code: 'second_phase_must_not_be_round_robin',
        index: 1,
      });
    }
    if (second.format === 'placement_playoff' && q % 2 !== 0) {
      errors.push({
        code: 'qualifiers_must_be_even',
        index: 0,
        got: q,
      });
    }
    if (second.format === 'single_elimination' && q !== 4) {
      // Brackets > 4 are configurable but the placeholder generator only
      // ships 4-team semis-and-final today. Cap until PR6c lifts this.
      errors.push({
        code: 'single_elim_qualifiers_must_be_4',
        index: 0,
        got: q,
      });
    }
  }

  return errors;
}
