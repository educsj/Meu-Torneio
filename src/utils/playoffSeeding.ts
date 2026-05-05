import type { Match, Participant, ScoringRule } from '@/types/tournament';

import { bracketSeedOrder } from './bracket';
import { computeStandings } from './standings';

/** Pair of participant ids that should occupy slot A and slot B of a
 * knockout match. Returned by the seeding helpers so the DB layer can
 * just iterate and persist. */
export interface SlotPair {
  participantAId: number;
  participantBId: number;
}

/**
 * Compute placement-playoff pairings for a single-group league:
 *   index 0 → final           (1st vs 2nd in standings)
 *   index 1 → 3rd-place match (3rd vs 4th)
 *   ...
 *
 * Returns null if there are fewer than 4 ranked participants — caller
 * should skip seeding rather than partially populate slots.
 */
export function computeLeaguePlayoffSeeding(
  leagueMatches: Match[],
  participants: Participant[],
  options: { scoring?: ScoringRule } = {}
): SlotPair[] | null {
  const standings = computeStandings(leagueMatches, participants, options);
  if (standings.length < 4) return null;
  return [
    {
      participantAId: standings[0].participantId,
      participantBId: standings[1].participantId,
    },
    {
      participantAId: standings[2].participantId,
      participantBId: standings[3].participantId,
    },
  ];
}

/**
 * Compute single-elimination bracket seeding from a single league's
 * standings. Takes the top `qualifiers` participants and arranges them
 * into bracket positions via the standard NCAA-style seed order:
 *   K=4  → 1v4, 2v3
 *   K=8  → 1v8, 4v5, 2v7, 3v6
 *   K=16 → 1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11
 *
 * Returns null when the standings have fewer entries than `qualifiers`,
 * or when `qualifiers` isn't a power of two ≥ 2.
 */
export function computeSingleLeagueBracketSeeding(
  leagueMatches: Match[],
  participants: Participant[],
  qualifiers: number,
  options: { scoring?: ScoringRule } = {}
): SlotPair[] | null {
  if (
    qualifiers < 2 ||
    (qualifiers & (qualifiers - 1)) !== 0
  ) {
    return null;
  }
  const standings = computeStandings(leagueMatches, participants, options);
  if (standings.length < qualifiers) return null;
  const seedOrder = bracketSeedOrder(qualifiers);
  // seedOrder gives the seed number (1-based) at each bracket slot. For
  // round 1 we pair slots [0,1], [2,3], etc.
  const pairs: SlotPair[] = [];
  for (let i = 0; i < qualifiers; i += 2) {
    pairs.push({
      participantAId: standings[seedOrder[i] - 1].participantId,
      participantBId: standings[seedOrder[i + 1] - 1].participantId,
    });
  }
  return pairs;
}

/**
 * Compute cross-pairings for groups+knockout (2 groups → 2 semis):
 *   index 0 → 1A vs 2B
 *   index 1 → 1B vs 2A
 *
 * Picks the first two group labels (sorted alphabetically). Returns null
 * if either group has fewer than 2 ranked participants — same caller
 * contract as computeLeaguePlayoffSeeding.
 */
export function computeGroupsKnockoutSeeding(
  groupMatches: Match[],
  participants: Participant[],
  options: { scoring?: ScoringRule } = {}
): SlotPair[] | null {
  const groupLabels = Array.from(
    new Set(
      groupMatches
        .map((m) => m.groupLabel)
        .filter((g): g is string => g != null)
    )
  ).sort();

  const topByGroup = new Map<string, { firstId: number; secondId: number }>();
  for (const label of groupLabels) {
    const matches = groupMatches.filter((m) => m.groupLabel === label);
    // Restrict participants to those who actually played in this group.
    // Without this, computeStandings would treat the whole tournament's
    // participants as one giant group and zero out unrelated rows.
    const ids = new Set<number>();
    for (const m of matches) {
      if (m.participantAId) ids.add(m.participantAId);
      if (m.participantBId) ids.add(m.participantBId);
    }
    const groupParticipants = participants.filter((p) => ids.has(p.id));
    const standings = computeStandings(matches, groupParticipants, options);
    if (standings.length < 2) continue;
    topByGroup.set(label, {
      firstId: standings[0].participantId,
      secondId: standings[1].participantId,
    });
  }

  if (topByGroup.size < 2) return null;
  const [labelA, labelB] = groupLabels.slice(0, 2);
  const a = topByGroup.get(labelA);
  const b = topByGroup.get(labelB);
  if (!a || !b) return null;

  return [
    { participantAId: a.firstId, participantBId: b.secondId },
    { participantAId: b.firstId, participantBId: a.secondId },
  ];
}
