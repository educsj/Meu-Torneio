import { describe, expect, it } from 'vitest';

import {
  computeTournamentStatus,
  type StatusInputMatch,
} from './tournamentStatus';

function m(partial: Partial<StatusInputMatch>): StatusInputMatch {
  return {
    stage: 'main',
    scoreA: null,
    scoreB: null,
    winnerId: null,
    nextMatchId: null,
    groupLabel: null,
    ...partial,
  };
}

describe('computeTournamentStatus', () => {
  it('returns null for empty match sets (caller leaves status untouched)', () => {
    expect(computeTournamentStatus('single_elimination', [])).toBeNull();
    expect(computeTournamentStatus('round_robin', [])).toBeNull();
    expect(computeTournamentStatus('groups_knockout', [])).toBeNull();
    expect(computeTournamentStatus('league_playoff', [])).toBeNull();
  });

  describe('single_elimination', () => {
    it('draft when nothing has been played yet', () => {
      const matches = [
        m({ nextMatchId: 2 }),
        m({ nextMatchId: 2 }),
        m({ nextMatchId: null }), // final
      ];
      expect(computeTournamentStatus('single_elimination', matches)).toBe(
        'draft'
      );
    });

    it('ongoing when a non-final match has a score', () => {
      const matches = [
        m({ scoreA: 2, scoreB: 1, winnerId: 1, nextMatchId: 2 }),
        m({ nextMatchId: 2 }),
        m({ nextMatchId: null }),
      ];
      expect(computeTournamentStatus('single_elimination', matches)).toBe(
        'ongoing'
      );
    });

    it('finished when the final has a winner', () => {
      const matches = [
        m({ scoreA: 2, scoreB: 1, winnerId: 1, nextMatchId: 2 }),
        m({ scoreA: 0, scoreB: 3, winnerId: 4, nextMatchId: 2 }),
        m({ scoreA: 3, scoreB: 2, winnerId: 1, nextMatchId: null }),
      ];
      expect(computeTournamentStatus('single_elimination', matches)).toBe(
        'finished'
      );
    });

    it('still ongoing when final has score but no winnerId yet (defensive)', () => {
      // shouldn't normally happen — defensive check that we look at winnerId,
      // not just scores.
      const matches = [m({ scoreA: 1, scoreB: 1, nextMatchId: null })];
      expect(computeTournamentStatus('single_elimination', matches)).toBe(
        'ongoing'
      );
    });
  });

  describe('round_robin', () => {
    it('draft when nothing played', () => {
      const matches = [m({}), m({}), m({})];
      expect(computeTournamentStatus('round_robin', matches)).toBe('draft');
    });

    it('ongoing when some matches played', () => {
      const matches = [
        m({ scoreA: 1, scoreB: 0, winnerId: 1 }),
        m({}),
        m({}),
      ];
      expect(computeTournamentStatus('round_robin', matches)).toBe('ongoing');
    });

    it('finished only when EVERY match has both scores', () => {
      const matches = [
        m({ scoreA: 1, scoreB: 0 }),
        m({ scoreA: 2, scoreB: 2 }), // draw counts as played
        m({ scoreA: 0, scoreB: 3 }),
      ];
      expect(computeTournamentStatus('round_robin', matches)).toBe('finished');
    });
  });

  describe('groups_knockout', () => {
    it('finished when knockout final has winner, regardless of group results', () => {
      const matches = [
        m({ stage: 'group', scoreA: 1, scoreB: 0, winnerId: 1 }),
        m({ stage: 'group', scoreA: 0, scoreB: 2, winnerId: 4 }),
        m({ stage: 'knockout', scoreA: 3, scoreB: 1, winnerId: 1, nextMatchId: 99 }),
        m({ stage: 'knockout', scoreA: 2, scoreB: 1, winnerId: 4, nextMatchId: 99 }),
        m({ stage: 'knockout', scoreA: 3, scoreB: 0, winnerId: 1, nextMatchId: null }),
      ];
      expect(computeTournamentStatus('groups_knockout', matches)).toBe(
        'finished'
      );
    });

    it('ongoing when group stage played but knockout final has no winner', () => {
      const matches = [
        m({ stage: 'group', scoreA: 1, scoreB: 0, winnerId: 1 }),
        m({ stage: 'knockout', nextMatchId: 99 }),
        m({ stage: 'knockout', nextMatchId: 99 }),
        m({ stage: 'knockout', nextMatchId: null }),
      ];
      expect(computeTournamentStatus('groups_knockout', matches)).toBe(
        'ongoing'
      );
    });

    it('draft when nothing played at all', () => {
      const matches = [
        m({ stage: 'group' }),
        m({ stage: 'knockout', nextMatchId: 99 }),
        m({ stage: 'knockout', nextMatchId: null }),
      ];
      expect(computeTournamentStatus('groups_knockout', matches)).toBe(
        'draft'
      );
    });
  });

  describe('league_playoff', () => {
    it('finished only when ALL placement matches have winners (parallel, no tree)', () => {
      const matches = [
        m({ stage: 'group', scoreA: 3, scoreB: 1, winnerId: 1 }),
        m({ stage: 'group', scoreA: 2, scoreB: 2 }),
        m({ stage: 'knockout', scoreA: 3, scoreB: 1, winnerId: 1 }), // final
        m({ stage: 'knockout', scoreA: 3, scoreB: 0, winnerId: 3 }), // 3rd place
      ];
      expect(computeTournamentStatus('league_playoff', matches)).toBe(
        'finished'
      );
    });

    it('NOT finished when only the final has a winner (3rd-place still pending)', () => {
      // This is the case that would have falsely shown "finished" under the
      // groups_knockout branch (which uses .find for the final-with-no-next).
      const matches = [
        m({ stage: 'group', scoreA: 3, scoreB: 1, winnerId: 1 }),
        m({ stage: 'knockout', scoreA: 3, scoreB: 1, winnerId: 1 }), // final done
        m({ stage: 'knockout' }), // 3rd-place still empty
      ];
      expect(computeTournamentStatus('league_playoff', matches)).toBe(
        'ongoing'
      );
    });

    it('NOT finished when only the 3rd-place has a winner', () => {
      const matches = [
        m({ stage: 'group', scoreA: 3, scoreB: 1, winnerId: 1 }),
        m({ stage: 'knockout' }), // final pending
        m({ stage: 'knockout', scoreA: 3, scoreB: 0, winnerId: 3 }), // 3rd done
      ];
      expect(computeTournamentStatus('league_playoff', matches)).toBe(
        'ongoing'
      );
    });

    it('draft when no matches played', () => {
      const matches = [
        m({ stage: 'group' }),
        m({ stage: 'group' }),
        m({ stage: 'knockout' }),
        m({ stage: 'knockout' }),
      ];
      expect(computeTournamentStatus('league_playoff', matches)).toBe('draft');
    });

    it('ongoing during the league phase', () => {
      const matches = [
        m({ stage: 'group', scoreA: 1, scoreB: 0, winnerId: 1 }),
        m({ stage: 'group' }),
        m({ stage: 'knockout' }),
        m({ stage: 'knockout' }),
      ];
      expect(computeTournamentStatus('league_playoff', matches)).toBe(
        'ongoing'
      );
    });
  });

  describe('double_elimination — bracket reset', () => {
    // Helper: GF1 with the WB Champion in slot A (id=1) and LB Champion
    // in slot B (id=2). winnerId picks who won.
    const gf1 = (winnerId: number | null) =>
      m({
        groupLabel: 'GF',
        round: 1,
        participantAId: 1,
        scoreA: winnerId ? 3 : null,
        scoreB: winnerId ? 1 : null,
        winnerId,
      });
    const gf2 = (winnerId: number | null) =>
      m({
        groupLabel: 'GF',
        round: 2,
        participantAId: 1,
        scoreA: winnerId ? 3 : null,
        scoreB: winnerId ? 1 : null,
        winnerId,
      });

    it('finished when GF1 winner is the WB Champion (no rematch needed)', () => {
      // GF2 exists (reset configured) but is irrelevant because the WB
      // Champion (slot A, id=1) won GF1 — they have 0 losses still.
      expect(
        computeTournamentStatus('double_elimination', [gf1(1), gf2(null)])
      ).toBe('finished');
    });

    it('ongoing when LB Champion won GF1 but GF2 has no winner yet', () => {
      // LB Champion (slot B, id=2) won GF1 → both have 1 loss → GF2 must
      // be played to crown the champion.
      expect(
        computeTournamentStatus('double_elimination', [gf1(2), gf2(null)])
      ).toBe('ongoing');
    });

    it('finished when LB Champion won GF1 AND GF2 has a winner', () => {
      expect(
        computeTournamentStatus('double_elimination', [gf1(2), gf2(1)])
      ).toBe('finished');
      expect(
        computeTournamentStatus('double_elimination', [gf1(2), gf2(2)])
      ).toBe('finished');
    });

    it('still finished without GF2 when GF1 has any winner (no reset configured)', () => {
      expect(computeTournamentStatus('double_elimination', [gf1(1)])).toBe(
        'finished'
      );
      expect(computeTournamentStatus('double_elimination', [gf1(2)])).toBe(
        'finished'
      );
    });
  });
});
