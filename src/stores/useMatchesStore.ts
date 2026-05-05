import { create } from 'zustand';

import {
  clearMatchScore,
  deleteMatchesForTournament,
  generateBracketForTournament,
  listMatches,
  recomputeTournamentStatus,
  setMatchScore,
} from '@/db/matches';
import type { Match } from '@/types/tournament';

import { useTournamentsStore } from './useTournamentsStore';

interface MatchesState {
  byTournament: Record<number, Match[]>;
  loading: boolean;
  error: string | null;
  load: (tournamentId: number) => Promise<void>;
  generate: (tournamentId: number) => Promise<Match[]>;
  reset: (tournamentId: number) => Promise<void>;
  setScore: (
    tournamentId: number,
    matchId: number,
    scoreA: number,
    scoreB: number
  ) => Promise<void>;
  clearScore: (tournamentId: number, matchId: number) => Promise<void>;
  clearForTournament: (tournamentId: number) => void;
}

export const useMatchesStore = create<MatchesState>((set, get) => ({
  byTournament: {},
  loading: false,
  error: null,
  load: async (tournamentId) => {
    set({ loading: true, error: null });
    try {
      const list = await listMatches(tournamentId);
      set({
        byTournament: { ...get().byTournament, [tournamentId]: list },
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },
  generate: async (tournamentId) => {
    const list = await generateBracketForTournament(tournamentId);
    set({
      byTournament: { ...get().byTournament, [tournamentId]: list },
    });
    return list;
  },
  reset: async (tournamentId) => {
    await deleteMatchesForTournament(tournamentId);
    set({
      byTournament: { ...get().byTournament, [tournamentId]: [] },
    });
    await useTournamentsStore.getState().refresh();
  },
  setScore: async (tournamentId, matchId, scoreA, scoreB) => {
    await setMatchScore(matchId, scoreA, scoreB);
    await recomputeTournamentStatus(tournamentId);
    const list = await listMatches(tournamentId);
    set({
      byTournament: { ...get().byTournament, [tournamentId]: list },
    });
    await useTournamentsStore.getState().refresh();
  },
  clearScore: async (tournamentId, matchId) => {
    await clearMatchScore(matchId);
    await recomputeTournamentStatus(tournamentId);
    const list = await listMatches(tournamentId);
    set({
      byTournament: { ...get().byTournament, [tournamentId]: list },
    });
    await useTournamentsStore.getState().refresh();
  },
  clearForTournament: (tournamentId) => {
    const next = { ...get().byTournament };
    delete next[tournamentId];
    set({ byTournament: next });
  },
}));
