import { create } from 'zustand';

import {
  createTournament,
  deleteTournament,
  listTournaments,
} from '@/db/tournaments';
import type { Tournament, TournamentType } from '@/types/tournament';

interface TournamentsState {
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (input: { name: string; type: TournamentType }) => Promise<Tournament>;
  remove: (id: number) => Promise<void>;
}

export const useTournamentsStore = create<TournamentsState>((set, get) => ({
  tournaments: [],
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const tournaments = await listTournaments();
      set({ tournaments, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },
  add: async (input) => {
    const tournament = await createTournament(input);
    set({ tournaments: [tournament, ...get().tournaments] });
    return tournament;
  },
  remove: async (id) => {
    await deleteTournament(id);
    set({ tournaments: get().tournaments.filter((t) => t.id !== id) });
  },
}));
