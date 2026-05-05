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
