import { create } from 'zustand';

import {
  createTournament,
  deleteTournament,
  getTournamentById,
  listTournaments,
  renameTournament,
} from '@/db/tournaments';
import type {
  CustomPhaseInput,
  Tournament,
  TournamentType,
} from '@/types/tournament';

interface TournamentsState {
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (input: {
    name: string;
    type: TournamentType;
    customPhases?: CustomPhaseInput[];
  }) => Promise<Tournament>;
  remove: (id: number) => Promise<void>;
  rename: (id: number, name: string) => Promise<void>;
  getById: (id: number) => Tournament | undefined;
  fetchById: (id: number) => Promise<Tournament | null>;
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
  rename: async (id, name) => {
    await renameTournament(id, name);
    set({
      tournaments: get().tournaments.map((t) =>
        t.id === id ? { ...t, name } : t
      ),
    });
  },
  getById: (id) => get().tournaments.find((t) => t.id === id),
  fetchById: async (id) => {
    const cached = get().tournaments.find((t) => t.id === id);
    if (cached) return cached;
    const fetched = await getTournamentById(id);
    if (fetched) {
      set({ tournaments: [fetched, ...get().tournaments] });
    }
    return fetched;
  },
}));
