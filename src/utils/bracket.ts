import type { Participant } from '@/types/tournament';

export interface BracketMatch {
  round: number;
  indexInRound: number;
  participantAId: number | null;
  participantBId: number | null;
  /** Auto-set winner when one side is BYE. */
  winnerId: number | null;
  /** Index of the next-round match this feeds into. */
  nextRoundIndex: number | null;
  /** Stage label: 'main' (single elim or RR), 'group' (group stage), 'knockout'. */
  stage?: 'main' | 'group' | 'knockout';
  /** Group label like 'A', 'B' (only set for stage='group'). */
  groupLabel?: string | null;
}

/** Smallest power of two greater than or equal to n. */
export function nextPowerOfTwo(n: number): number {
  if (n < 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

/**
 * Standard tournament seeding order for a bracket of `size` slots.
 * Returns an array where index i holds the seed (1-based) that goes into
 * slot i of the first round. e.g. size=8 → [1,8,4,5,2,7,3,6].
 */
export function bracketSeedOrder(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error('Bracket size must be a power of two >= 2');
  }
  let arr = [1, 2];
  while (arr.length < size) {
    const total = arr.length * 2 + 1;
    const next: number[] = [];
    for (const seed of arr) {
      next.push(seed, total - seed);
    }
    arr = next;
  }
  return arr;
}

/**
 * Generate a single-elimination bracket for the given participants.
 *
 * Returns a flat list of matches across all rounds. Round 1 holds the
 * first matches (with BYEs auto-resolved). Subsequent rounds hold
 * placeholder matches (both sides null) linked back via `nextRoundIndex`.
 *
 * Participants are sorted by `seed` (nulls last, then by id), so the
 * caller can control seeding by setting `seed` on each participant.
 */
export function generateSingleEliminationBracket(
  participants: Participant[]
): BracketMatch[] {
  if (participants.length < 2) {
    throw new Error('Need at least 2 participants to generate a bracket');
  }

  const sorted = [...participants].sort((a, b) => {
    const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
    const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });

  const bracketSize = nextPowerOfTwo(sorted.length);
  const order = bracketSeedOrder(bracketSize);

  // slot[i] = participant assigned to bracket position i (or null = BYE)
  const slots: (Participant | null)[] = order.map(
    (seed) => sorted[seed - 1] ?? null
  );

  const totalRounds = Math.log2(bracketSize);
  const matches: BracketMatch[] = [];

  // Round 1
  const round1: BracketMatch[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    let winnerId: number | null = null;
    if (a && !b) winnerId = a.id;
    else if (!a && b) winnerId = b.id;
    round1.push({
      round: 1,
      indexInRound: i / 2,
      participantAId: a?.id ?? null,
      participantBId: b?.id ?? null,
      winnerId,
      nextRoundIndex: totalRounds > 1 ? Math.floor(i / 4) : null,
    });
  }
  matches.push(...round1);

  // Subsequent rounds: placeholders
  let prevRoundCount = round1.length;
  for (let r = 2; r <= totalRounds; r++) {
    const count = prevRoundCount / 2;
    for (let i = 0; i < count; i++) {
      matches.push({
        round: r,
        indexInRound: i,
        participantAId: null,
        participantBId: null,
        winnerId: null,
        nextRoundIndex: r < totalRounds ? Math.floor(i / 2) : null,
      });
    }
    prevRoundCount = count;
  }

  return matches;
}

/**
 * Split participants into N balanced groups using snake-order seeding,
 * so seeds are spread evenly (top seeds aren't all in one group).
 */
export function splitIntoGroups<T extends { id: number; seed?: number | null }>(
  participants: T[],
  groupCount: number
): T[][] {
  if (groupCount < 1) throw new Error('Need at least 1 group');
  const sorted = [...participants].sort((a, b) => {
    const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
    const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  let direction: 1 | -1 = 1;
  let idx = 0;
  for (const p of sorted) {
    groups[idx].push(p);
    idx += direction;
    if (idx === groupCount) {
      direction = -1;
      idx = groupCount - 1;
    } else if (idx === -1) {
      direction = 1;
      idx = 0;
    }
  }
  return groups;
}

/**
 * Generate the GROUP STAGE matches for a "groups + knockout" tournament.
 *
 * Strategy: split into 2 balanced groups (snake seeding). Each group plays a
 * round-robin internally. Knockout bracket is left empty here — caller
 * generates it later (when group stage finishes) using `generateKnockoutFromGroupStandings`.
 *
 * Returns just the group-stage matches. Knockout matches are pre-created as
 * empty placeholders separately by `generateGroupsKnockoutSkeleton`.
 */
export function generateGroupStageMatches(
  participants: Participant[],
  groupCount = 2
): BracketMatch[] {
  if (participants.length < groupCount * 2) {
    throw new Error(
      `Mínimo de ${groupCount * 2} participantes para ${groupCount} grupos.`
    );
  }
  const groups = splitIntoGroups(participants, groupCount);
  const matches: BracketMatch[] = [];
  for (let g = 0; g < groups.length; g++) {
    const label = String.fromCharCode(65 + g); // 'A', 'B', ...
    const group = groups[g];
    // Each group runs its own round-robin schedule. Round numbers are
    // per-group (group A round 1 and group B round 1 are independent).
    const schedule = scheduleRoundRobin(group.length);
    for (let r = 0; r < schedule.length; r++) {
      schedule[r].forEach(([i, j], idx) => {
        matches.push({
          round: r + 1,
          indexInRound: idx,
          participantAId: group[i].id,
          participantBId: group[j].id,
          winnerId: null,
          nextRoundIndex: null,
          stage: 'group',
          groupLabel: label,
        });
      });
    }
  }
  return matches;
}

/**
 * Generate empty single-elimination placeholders sized for `qualifiers`
 * teams. Builds a complete bracket (no BYEs): for K teams there are K/2
 * round-1 matches, K/4 round-2 matches, …, 1 final. All slots are null;
 * the seeder fills them when the source phase finishes.
 *
 *   K = 2  → 1 match  (final only)
 *   K = 4  → 2 + 1    (semis + final)
 *   K = 8  → 4 + 2 + 1 (QFs + semis + final)
 *   K = 16 → 8 + 4 + 2 + 1
 *
 * Throws if K isn't a power of two ≥ 2.
 */
export function generateSingleEliminationPlaceholders(
  qualifiers: number
): BracketMatch[] {
  if (
    qualifiers < 2 ||
    (qualifiers & (qualifiers - 1)) !== 0
  ) {
    throw new Error('qualifiers must be a power of two ≥ 2');
  }
  const matches: BracketMatch[] = [];
  const totalRounds = Math.log2(qualifiers);
  let prevRoundCount = qualifiers / 2;
  for (let r = 1; r <= totalRounds; r++) {
    for (let i = 0; i < prevRoundCount; i++) {
      matches.push({
        round: r,
        indexInRound: i,
        participantAId: null,
        participantBId: null,
        winnerId: null,
        nextRoundIndex: r < totalRounds ? Math.floor(i / 2) : null,
        stage: 'knockout',
        groupLabel: null,
      });
    }
    prevRoundCount = prevRoundCount / 2;
  }
  return matches;
}

/**
 * Backwards-compatible alias for the original 4-team groups+knockout
 * shape (2 semis + 1 final). New code should call
 * generateSingleEliminationPlaceholders(4) directly.
 */
export function generateGroupsKnockoutPlaceholders(): BracketMatch[] {
  return generateSingleEliminationPlaceholders(4);
}

/**
 * Generate round-robin pairings using the circle (Berger) method.
 *
 * Each round contains parallel matches — for N teams, N/2 matches per
 * round and N-1 rounds total. No team plays twice in the same round.
 * For odd N, one team has a bye each round (omitted from output).
 *
 * - legs=1 (default): rounds 1..N-1, each pair plays once.
 * - legs=2: rounds 1..2(N-1); the second leg repeats the schedule with
 *   home/away reversed (the conventional "ida-e-volta").
 */
export function generateRoundRobinMatches(
  participants: Participant[],
  options: { legs?: 1 | 2 } = {}
): BracketMatch[] {
  if (participants.length < 2) {
    throw new Error('Need at least 2 participants to generate matches');
  }
  const legs = options.legs ?? 1;
  const sorted = [...participants].sort((a, b) => {
    const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
    const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });

  const schedule = scheduleRoundRobin(sorted.length);
  const matches: BracketMatch[] = [];
  for (let leg = 1; leg <= legs; leg++) {
    for (let r = 0; r < schedule.length; r++) {
      const round = (leg - 1) * schedule.length + r + 1;
      schedule[r].forEach(([i, j], idx) => {
        // Reverse home/away on the second leg so each pairing alternates mando.
        const a = leg === 1 ? sorted[i] : sorted[j];
        const b = leg === 1 ? sorted[j] : sorted[i];
        matches.push({
          round,
          indexInRound: idx,
          participantAId: a.id,
          participantBId: b.id,
          winnerId: null,
          nextRoundIndex: null,
        });
      });
    }
  }
  return matches;
}

/**
 * Round-robin schedule generator (circle / Berger method).
 *
 * Returns an array of rounds; each round is an array of [i, j] pairs of
 * 0-based indices into the participant list. For odd N, an N-th phantom
 * index is added internally and any pair touching it is dropped — so the
 * team paired with the phantom that round has a bye.
 *
 * Mechanism: arrange teams in two rows; pair vertically (0↔M-1, 1↔M-2, …);
 * keep position 0 fixed and rotate the rest one slot clockwise per round.
 * After M-1 rotations every pair has met exactly once.
 */
export function scheduleRoundRobin(n: number): Array<Array<[number, number]>> {
  if (n < 2) return [];
  const useGhost = n % 2 === 1;
  const m = useGhost ? n + 1 : n;
  let teams = Array.from({ length: m }, (_, i) => i);
  const rounds: Array<Array<[number, number]>> = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < m / 2; i++) {
      const a = teams[i];
      const b = teams[m - 1 - i];
      // Index === n is the phantom — its opponent has a bye this round.
      if (useGhost && (a === n || b === n)) continue;
      pairs.push([a, b]);
    }
    rounds.push(pairs);
    // Rotate: keep teams[0] fixed, shift the rest one slot.
    teams = [teams[0], teams[m - 1], ...teams.slice(1, m - 1)];
  }
  return rounds;
}

/**
 * Empty placement-playoff matches: `spots/2` parallel matches that decide
 * placement (1st vs 2nd → final, 3rd vs 4th → 3rd-place, etc.). No bracket
 * tree — each match's `nextRoundIndex` is null and they all share round=1.
 *
 * Used by the `league_playoff` preset (and any other format that wants
 * placement matches after a league phase).
 */
export function generatePlacementPlayoffPlaceholders(
  spots: number
): BracketMatch[] {
  if (spots < 2 || spots % 2 !== 0) {
    throw new Error('spots must be an even number ≥ 2');
  }
  const matches: BracketMatch[] = [];
  for (let i = 0; i < spots / 2; i++) {
    matches.push({
      round: 1,
      indexInRound: i,
      participantAId: null,
      participantBId: null,
      winnerId: null,
      nextRoundIndex: null,
      stage: 'knockout',
      groupLabel: null,
    });
  }
  return matches;
}
