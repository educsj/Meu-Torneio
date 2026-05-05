import type { Match, Participant, ScoringRule } from '@/types/tournament';

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
