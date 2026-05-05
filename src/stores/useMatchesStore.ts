import { create } from 'zustand';

import {
  clearMatchScore,
  deleteMatchesForTournament,
  generateBracketForTournament,
  isGroupStageComplete,
  listMatches,
  recomputeTournamentStatus,
  seedNextPhase,
  setMatchSchedule,
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
  saveSchedule: (
    tournamentId: number,
    matchId: number,
    scheduledAt: string | null,
    location: string | null
  ) => Promise<void>;
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
    const tournament = useTournamentsStore.getState().getById(tournamentId);
    const allowDraws = tournament
      ? tournament.type !== 'single_elimination'
      : false;
    await setMatchScore(matchId, scoreA, scoreB, { allowDraws });
    if (await isGroupStageComplete(tournamentId)) {
      await seedNextPhase(tournamentId);
    }
    await recomputeTournamentStatus(tournamentId);
    const list = await listMatches(tournamentId);
    set({
      byTournament: { ...get().byTournament, [tournamentId]: list },
    });
    await useTournamentsStore.getState().refresh();
  },
  clearScore: async (tournamentId, matchId) => {
    await clearMatchScore(matchId);
    if (await isGroupStageComplete(tournamentId)) {
      await seedNextPhase(tournamentId);
    }
    await recomputeTournamentStatus(tournamentId);
    const list = await listMatches(tournamentId);
    set({
      byTournament: { ...get().byTournament, [tournamentId]: list },
    });
    await useTournamentsStore.getState().refresh();
  },
  saveSchedule: async (tournamentId, matchId, scheduledAt, location) => {
    await setMatchSchedule(matchId, scheduledAt, location);
    const list = await listMatches(tournamentId);
    set({
      byTournament: { ...get().byTournament, [tournamentId]: list },
    });
  },
  clearForTournament: (tournamentId) => {
    const next = { ...get().byTournament };
    delete next[tournamentId];
    set({ byTournament: next });
  },
}));
