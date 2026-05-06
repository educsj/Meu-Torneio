import type { MatchStage, Participant, Phase } from '@/types/tournament';

import {
  generateDoubleEliminationBracket,
  generateGroupStageMatches,
  generatePlacementPlayoffPlaceholders,
  generateRoundRobinMatches,
  generateSingleEliminationBracket,
  generateSingleEliminationPlaceholders,
  type BracketMatch,
} from './bracket';

/**
 * Compute the matches for a tournament described as an ordered list of
 * phases. Pure — no DB; the caller persists the returned BracketMatch[].
 *
 * The function preserves the existing presets' output (single_elimination,
 * round_robin, groups_knockout, league_playoff) so the refactor is a
 * drop-in replacement for the legacy `if (tournament.type === ...)` chain
 * inside generateBracketForTournament.
 *
 * Stage tagging rule:
 *   - Single-phase tournament  → all matches stage='main'
 *   - Multi-phase tournament   → first phase stage='group',
 *                                later phases stage='knockout'
 *
 * Cross-phase qualifier flow: each non-first phase reads its predecessor's
 * `qualifiers` field to decide its placeholder size (e.g. a placement_playoff
 * phase with qualifiers=4 from the previous league produces 2 placement
 * matches: 1v2 and 3v4).
 */
export function generateBracketFromPhases(
  phases: Phase[],
  participants: Participant[]
): BracketMatch[] {
  if (phases.length === 0) {
    throw new Error('Tournament has no phases configured.');
  }
  const isMultiPhase = phases.length > 1;
  const sorted = [...phases].sort((a, b) => a.ordinal - b.ordinal);
  const result: BracketMatch[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const phase = sorted[i];
    const previous = i === 0 ? null : sorted[i - 1];
    const qualifiersIn = previous?.qualifiers ?? null;
    const stage: MatchStage = isMultiPhase
      ? i === 0
        ? 'group'
        : 'knockout'
      : 'main';

    const phaseMatches = matchesForPhase(
      phase,
      participants,
      i === 0,
      qualifiersIn,
      stage
    );
    result.push(...phaseMatches);
  }

  return result;
}

function matchesForPhase(
  phase: Phase,
  participants: Participant[],
  isFirstPhase: boolean,
  qualifiersIn: number | null,
  stage: MatchStage
): BracketMatch[] {
  switch (phase.format) {
    case 'round_robin': {
      // Multi-group: snake-seeded groups (uses groupCount). Single group:
      // a flat round-robin, optionally with home-and-away (legs=2).
      let matches: BracketMatch[];
      if (phase.groupCount > 1) {
        matches = generateGroupStageMatches(participants, phase.groupCount);
      } else {
        matches = generateRoundRobinMatches(participants, { legs: phase.legs });
      }
      // Force the stage; preserve any groupLabel set by the generator
      // (multi-group sets 'A','B',...; single group leaves it null).
      return matches.map((m) => ({
        ...m,
        stage,
        groupLabel: m.groupLabel ?? null,
      }));
    }

    case 'single_elimination': {
      if (isFirstPhase) {
        return generateSingleEliminationBracket(participants, {
          thirdPlace: phase.thirdPlace,
        }).map((m) => ({
          ...m,
          stage,
          // Preserve the THIRD_PLACE_LABEL set by the generator; pure-SE
          // tournaments don't carry a real groupLabel so the default null
          // is fine for everything else.
          groupLabel: m.groupLabel ?? null,
        }));
      }
      // Later phase: bracket is sized by the previous phase's qualifiers
      // count. Any power of two from 2 (final only) up to 16 is supported.
      const qualifiers = qualifiersIn ?? 4;
      return generateSingleEliminationPlaceholders(qualifiers, {
        thirdPlace: phase.thirdPlace,
      }).map((m) => ({
        ...m,
        stage,
        groupLabel: m.groupLabel ?? null,
      }));
    }

    case 'placement_playoff': {
      const spots = qualifiersIn ?? 4;
      return generatePlacementPlayoffPlaceholders(spots).map((m) => ({
        ...m,
        stage,
      }));
    }

    case 'double_elimination': {
      // DE only supported as a standalone first phase in the initial release.
      // Validation rejects DE as a non-first phase, so isFirstPhase is true.
      if (!isFirstPhase) {
        throw new Error('Double elimination must be the first phase.');
      }
      return generateDoubleEliminationBracket(participants).map((m) => ({
        ...m,
        stage,
        groupLabel: m.groupLabel ?? null,
      }));
    }
  }
}

/**
 * Minimum number of participants needed to play this phase composition.
 * Considers both the first phase's format requirements (e.g. multi-group
 * needs ≥2 per group) and the qualifier count it must produce for the next
 * phase (e.g. league_playoff's playoff phase needs 4 qualifiers).
 */
export function computeMinParticipantsForPhases(phases: Phase[]): number {
  if (phases.length === 0) return 2;
  const first = [...phases].sort((a, b) => a.ordinal - b.ordinal)[0];

  let formatMin = 2;
  if (first.format === 'round_robin' && first.groupCount > 1) {
    formatMin = first.groupCount * 2;
  } else if (first.format === 'double_elimination') {
    // DE requires a power-of-two count in [4, 16]. The minimum is 4 — UI
    // surfaces this so the user can't generate an empty bracket.
    formatMin = 4;
  }

  // First phase must produce enough qualifiers for the next phase to fill.
  const qualifiersOut = first.qualifiers ?? 0;
  return Math.max(formatMin, qualifiersOut);
}
