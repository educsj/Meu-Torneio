import { create } from 'zustand';

import {
  createParticipant,
  deleteParticipant,
  listParticipants,
  updateParticipantIcon,
} from '@/db/participants';
import type { Participant } from '@/types/tournament';

interface ParticipantsState {
  byTournament: Record<number, Participant[]>;
  loading: boolean;
  error: string | null;
  load: (tournamentId: number) => Promise<void>;
  add: (
    tournamentId: number,
    name: string,
    options?: { icon?: string | null; iconColor?: string | null }
  ) => Promise<Participant>;
  remove: (tournamentId: number, id: number) => Promise<void>;
  updateIcon: (
    tournamentId: number,
    id: number,
    icon: string | null,
    iconColor: string | null
  ) => Promise<void>;
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
  add: async (tournamentId, name, options) => {
    const created = await createParticipant({
      tournamentId,
      name,
      icon: options?.icon ?? null,
      iconColor: options?.iconColor ?? null,
    });
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
  updateIcon: async (tournamentId, id, icon, iconColor) => {
    await updateParticipantIcon(id, icon, iconColor);
    const current = get().byTournament[tournamentId] ?? [];
    set({
      byTournament: {
        ...get().byTournament,
        [tournamentId]: current.map((p) =>
          p.id === id ? { ...p, icon, iconColor } : p
        ),
      },
    });
  },
  clearForTournament: (tournamentId) => {
    const next = { ...get().byTournament };
    delete next[tournamentId];
    set({ byTournament: next });
  },
}));
