import { create } from 'zustand';

import {
  createParticipant,
  deleteParticipant,
  listParticipants,
} from '@/db/participants';
import type { Participant } from '@/types/tournament';

interface ParticipantsState {
  byTournament: Record<number, Participant[]>;
  loading: boolean;
  error: string | null;
  load: (tournamentId: number) => Promise<void>;
  add: (tournamentId: number, name: string) => Promise<Participant>;
  remove: (tournamentId: number, id: number) => Promise<void>;
  clearForTournament: (tournamentId: number) => void;
}

export const useParticipantsStore = create<ParticipantsState>((set, get) => ({
  byTournament: {},
  loading: false,
  error: null,
  load: async (tournamentId) => {
    set({ loading: true, error: null });
    try {
      const list = await listParticipants(tournamentId);
      set({
        byTournament: { ...get().byTournament, [tournamentId]: list },
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },
  add: async (tournamentId, name) => {
    const created = await createParticipant({ tournamentId, name });
    const current = get().byTournament[tournamentId] ?? [];
    set({
      byTournament: {
        ...get().byTournament,
        [tournamentId]: [...current, created],
      },
    });
    return created;
  },
  remove: async (tournamentId, id) => {
    await deleteParticipant(id);
    const current = get().byTournament[tournamentId] ?? [];
    set({
      byTournament: {
        ...get().byTournament,
        [tournamentId]: current.filter((p) => p.id !== id),
      },
    });
  },
  clearForTournament: (tournamentId) => {
    const next = { ...get().byTournament };
    delete next[tournamentId];
    set({ byTournament: next });
  },
}));
