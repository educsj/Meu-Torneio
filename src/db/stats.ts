import type { TournamentBundle } from '@/utils/stats';

import { listMatches } from './matches';
import { listParticipants } from './participants';
import { listPhases } from './phases';
import { listTournaments } from './tournaments';

/**
 * Load every tournament's participants + matches (+ the league phase's scoring
 * rule) as plain bundles for the cross-tournament stats screen. Reads only;
 * the heavy lifting (aggregation, champion detection) is the pure
 * `aggregateParticipantStats` in utils/stats.ts.
 */
export async function loadAllTournamentBundles(): Promise<TournamentBundle[]> {
  const tournaments = await listTournaments();
  const bundles = await Promise.all(
    tournaments.map(async (t) => {
      const [participants, matches, phases] = await Promise.all([
        listParticipants(t.id),
        listMatches(t.id),
        listPhases(t.id),
      ]);
      const sourcePhase = phases.find((p) => p.ordinal === 0);
      return {
        type: t.type,
        status: t.status,
        participants,
        matches,
        scoring: sourcePhase?.scoring,
      };
    })
  );
  return bundles;
}
