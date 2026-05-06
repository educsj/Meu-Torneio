import type { Participant } from '@/types/tournament';

/**
 * Marker stored in `groupLabel` to identify the 3rd-place playoff match
 * inside a single-elimination bracket. Pure-SE tournaments don't use
 * groupLabel for anything else, so this is unambiguous.
 */
export const THIRD_PLACE_LABEL = '3P';

/**
 * Group labels for double elimination — distinguish the winners bracket,
 * losers bracket, and grand final inside a single-stage DE tournament.
 */
export const WINNERS_BRACKET_LABEL = 'WB';
export const LOSERS_BRACKET_LABEL = 'LB';
export const GRAND_FINAL_LABEL = 'GF';

export interface BracketMatch {
  round: number;
  indexInRound: number;
  participantAId: number | null;
  participantBId: number | null;
  /** Auto-set winner when one side is BYE. */
  winnerId: number | null;
  /**
   * Index of the next-round match this feeds into (same stage / same
   * groupLabel). For double elimination — where the winner can cross over
   * to a different group (WB-Final winner → GF) — use `winnerDest*` fields
   * instead and leave this null.
   */
  nextRoundIndex: number | null;
  /** Stage label: 'main' (single elim or RR), 'group' (group stage), 'knockout'. */
  stage?: 'main' | 'group' | 'knockout';
  /** Group label like 'A', 'B' (only set for stage='group'). */
  groupLabel?: string | null;
  /**
   * Double-elimination cross-group destinations. When set, the persistence
   * layer wires `next_match_id` / `loser_next_match_id` by looking up the
   * match with the matching (groupLabel, round, indexInRound) coordinate
   * within the same stage. Slots are explicit because DE matches don't have
   * a clean "siblings sorted by id" rule like the single-elim bracket does.
   */
  winnerDestGroup?: string | null;
  winnerDestRound?: number | null;
  winnerDestIndex?: number | null;
  winnerDestSlot?: 'A' | 'B' | null;
  loserDestGroup?: string | null;
  loserDestRound?: number | null;
  loserDestIndex?: number | null;
  loserDestSlot?: 'A' | 'B' | null;
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
  participants: Participant[],
  options: { thirdPlace?: boolean } = {}
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

  if (options.thirdPlace && bracketSize >= 4) {
    matches.push(thirdPlacePlaceholder(totalRounds));
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
  qualifiers: number,
  options: { thirdPlace?: boolean } = {}
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
  if (options.thirdPlace && qualifiers >= 4) {
    matches.push({
      ...thirdPlacePlaceholder(totalRounds),
      stage: 'knockout',
    });
  }
  return matches;
}

/**
 * Build the placeholder match for a 3rd-place playoff. It sits in the same
 * round as the final (so it renders alongside it) but with indexInRound=1
 * and groupLabel=THIRD_PLACE_LABEL so the UI/seeder can find it.
 */
function thirdPlacePlaceholder(finalRound: number): BracketMatch {
  return {
    round: finalRound,
    indexInRound: 1,
    participantAId: null,
    participantBId: null,
    winnerId: null,
    nextRoundIndex: null,
    groupLabel: THIRD_PLACE_LABEL,
  };
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
 * Generate a double-elimination bracket. Every team needs to lose twice
 * to be eliminated: WB losers drop into LB; LB losers are out; the WB and
 * LB champions meet in a single grand final (no bracket-reset rematch in
 * the initial release).
 *
 * Returns a flat list of matches with three group labels:
 *   - 'WB' (winners bracket): standard single-elim shape.
 *   - 'LB' (losers bracket): minor/major round interleaving.
 *   - 'GF' (grand final): single match.
 *
 * Each WB match carries cross-group `winnerDest*` / `loserDest*` fields
 * so the persistence layer can wire next-match pointers across groups.
 *
 * Constraints (initial release): participant count must be a power of two
 * in [4, 16]. Non-power-of-two and >16 brackets are tractable but their
 * UX on a phone screen needs design work first.
 */
export function generateDoubleEliminationBracket(
  participants: Participant[],
  options: { bracketReset?: boolean } = {}
): BracketMatch[] {
  const N = participants.length;
  if (N < 4) {
    throw new Error('Double elimination needs at least 4 participants');
  }
  if ((N & (N - 1)) !== 0) {
    throw new Error('Double elimination requires a power-of-two count');
  }
  if (N > 16) {
    throw new Error('Double elimination is capped at 16 participants for now');
  }

  const k = Math.log2(N); // number of WB rounds
  const sorted = [...participants].sort((a, b) => {
    const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
    const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });
  const order = bracketSeedOrder(N);
  const slots = order.map((seed) => sorted[seed - 1]);

  const matches: BracketMatch[] = [];
  const lbLastRound = 2 * k - 2; // LB-Final round number

  // ── Winners bracket ────────────────────────────────────────────────────
  // WB-R1: actual participants paired by canonical seed order.
  const wbR1Count = N / 2;
  for (let m = 0; m < wbR1Count; m++) {
    const a = slots[m * 2];
    const b = slots[m * 2 + 1];
    matches.push({
      round: 1,
      indexInRound: m,
      participantAId: a.id,
      participantBId: b.id,
      winnerId: null,
      nextRoundIndex: null,
      stage: 'main',
      groupLabel: WINNERS_BRACKET_LABEL,
      // Winner advances to WB-R2 (or to GF when WB has only one round, but
      // that requires N=2 which we reject above so k≥2 always holds).
      winnerDestGroup: WINNERS_BRACKET_LABEL,
      winnerDestRound: 2,
      winnerDestIndex: Math.floor(m / 2),
      winnerDestSlot: m % 2 === 0 ? 'A' : 'B',
      // Loser drops to LB-R1, paired with the adjacent WB-R1 loser.
      loserDestGroup: LOSERS_BRACKET_LABEL,
      loserDestRound: 1,
      loserDestIndex: Math.floor(m / 2),
      loserDestSlot: m % 2 === 0 ? 'A' : 'B',
    });
  }

  // WB-R2 through WB-Final (round k). Empty placeholders.
  for (let r = 2; r <= k; r++) {
    const count = N / Math.pow(2, r);
    for (let m = 0; m < count; m++) {
      const isWBFinal = r === k;
      matches.push({
        round: r,
        indexInRound: m,
        participantAId: null,
        participantBId: null,
        winnerId: null,
        nextRoundIndex: null,
        stage: 'main',
        groupLabel: WINNERS_BRACKET_LABEL,
        // Winner of WB-Final → GF slot A. Earlier rounds → next WB round.
        winnerDestGroup: isWBFinal ? GRAND_FINAL_LABEL : WINNERS_BRACKET_LABEL,
        winnerDestRound: isWBFinal ? 1 : r + 1,
        winnerDestIndex: isWBFinal ? 0 : Math.floor(m / 2),
        winnerDestSlot: isWBFinal ? 'A' : m % 2 === 0 ? 'A' : 'B',
        // Loser destination: WB-R(i) for i<k → LB-R(2*(i-1)) M(m), slot A.
        // WB-Final loser → LB-R(2k-2) M(0) (= LB-Final), slot A.
        loserDestGroup: LOSERS_BRACKET_LABEL,
        loserDestRound: isWBFinal ? lbLastRound : 2 * (r - 1),
        loserDestIndex: isWBFinal ? 0 : m,
        loserDestSlot: 'A',
      });
    }
  }

  // ── Losers bracket ─────────────────────────────────────────────────────
  // Round size pattern (for k≥2):
  //   LB-R(2i-1) (minor) and LB-R(2i) (major) each have N/2^(i+1) matches.
  // Minor rounds (1,3,5,...) only contain LB-internal pairings.
  // Major rounds (2,4,6,...) pair LB winners with the round's WB drop-ins.
  for (let lbR = 1; lbR <= lbLastRound; lbR++) {
    const i = Math.ceil(lbR / 2); // 1-based group index
    const lbCount = N / Math.pow(2, i + 1);
    const isMinor = lbR % 2 === 1;
    const isLBFinal = lbR === lbLastRound;
    for (let m = 0; m < lbCount; m++) {
      let winnerDest: {
        group: string;
        round: number;
        index: number;
        slot: 'A' | 'B';
      };
      if (isLBFinal) {
        // LB-Final winner → GF slot B (WB champion holds slot A).
        winnerDest = {
          group: GRAND_FINAL_LABEL,
          round: 1,
          index: 0,
          slot: 'B',
        };
      } else if (isMinor) {
        // Minor → next major (same round size). LB winner takes slot B,
        // the WB drop-in (added by the WB match's loserDest) takes slot A.
        winnerDest = {
          group: LOSERS_BRACKET_LABEL,
          round: lbR + 1,
          index: m,
          slot: 'B',
        };
      } else {
        // Major → next minor (count halves). Pair LB winners adjacent.
        winnerDest = {
          group: LOSERS_BRACKET_LABEL,
          round: lbR + 1,
          index: Math.floor(m / 2),
          slot: m % 2 === 0 ? 'A' : 'B',
        };
      }
      matches.push({
        round: lbR,
        indexInRound: m,
        participantAId: null,
        participantBId: null,
        winnerId: null,
        nextRoundIndex: null,
        stage: 'main',
        groupLabel: LOSERS_BRACKET_LABEL,
        winnerDestGroup: winnerDest.group,
        winnerDestRound: winnerDest.round,
        winnerDestIndex: winnerDest.index,
        winnerDestSlot: winnerDest.slot,
        // LB losers are eliminated — no loser destination.
      });
    }
  }

  // ── Grand final ────────────────────────────────────────────────────────
  matches.push({
    round: 1,
    indexInRound: 0,
    participantAId: null,
    participantBId: null,
    winnerId: null,
    nextRoundIndex: null,
    stage: 'main',
    groupLabel: GRAND_FINAL_LABEL,
  });

  if (options.bracketReset) {
    // Bracket reset: a 2nd grand final played only when the LB Champion
    // wins GF1 (since that means both finalists then have one loss each).
    // Both slots are populated by a custom propagation step at score-time;
    // the UI hides this match when GF1 was won by the WB Champion.
    matches.push({
      round: 2,
      indexInRound: 0,
      participantAId: null,
      participantBId: null,
      winnerId: null,
      nextRoundIndex: null,
      stage: 'main',
      groupLabel: GRAND_FINAL_LABEL,
    });
  }

  return matches;
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
