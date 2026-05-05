import { create } from 'zustand';

import {
  deleteMatchesForTournament,
  generateBracketForTournament,
  listMatches,
} from '@/db/matches';
import type { Match } from '@/types/tournament';

interface MatchesState {
  byTournament: Record<number, Match[]>;
  loading: boolean;
  error: string | null;
  load: (tournamentId: number) => Promise<void>;
  generate: (tournamentId: number) => Promise<Match[]>;
  reset: (tournamentId: number) => Promise<void>;
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
  },
  clearForTournament: (tournamentId) => {
    const next = { ...get().byTournament };
    delete next[tournamentId];
    set({ byTournament: next });
  },
}));
