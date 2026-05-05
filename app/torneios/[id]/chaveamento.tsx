import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, GitBranch } from 'lucide-react-native';

import { BracketTree } from '@/components/BracketTree';
import { Screen } from '@/components/ui/Screen';
import { listParticipants } from '@/db/participants';
import { useThemeIcon } from '@/hooks/useThemeIcon';
import { useTranslation } from '@/i18n/useTranslation';
import { useMatchesStore } from '@/stores/useMatchesStore';
import { useTournamentsStore } from '@/stores/useTournamentsStore';
import type { Match, Participant } from '@/types/tournament';

const EMPTY_MATCHES: readonly Match[] = Object.freeze([]);

export default function BracketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const router = useRouter();
  const { t } = useTranslation();
  const icon = useThemeIcon();

  const tournament = useTournamentsStore((s) =>
    s.tournaments.find((tt) => tt.id === tournamentId)
  );
  const fetchById = useTournamentsStore((s) => s.fetchById);
  const matches = useMatchesStore(
    (s) => s.byTournament[tournamentId] ?? EMPTY_MATCHES
  ) as Match[];
  const load = useMatchesStore((s) => s.load);

  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    let cancelled = false;
    fetchById(tournamentId);
    load(tournamentId);
    listParticipants(tournamentId).then((list) => {
      if (cancelled) return;
      setParticipants(list);
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, fetchById, load]);

  const participantsById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  // For single_elim every match is part of the bracket. The route is
  // currently only navigated to from single_elim's detail screen, but we
  // defensively narrow to stage='main' anyway in case future formats
  // surface this view too.
  const bracketMatches = useMemo(
    () => matches.filter((m) => m.stage === 'main'),
    [matches]
  );

  return (
    <Screen>
      <View className="flex-row items-center pt-6">
        <Pressable
          onPress={() => router.back()}
          className="-ml-2 mr-2 rounded-full p-2 active:bg-slate-100 dark:active:bg-slate-800"
        >
          <ChevronLeft size={22} color={icon.secondary} />
        </Pressable>
        <Text className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('tournament.bracket')}
        </Text>
      </View>

      {!tournament ? null : bracketMatches.length === 0 ? (
        <View className="mt-16 items-center px-6">
          <View className="mb-4 rounded-full bg-slate-100 p-5 dark:bg-slate-800">
            <GitBranch size={32} color="#94a3b8" />
          </View>
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {t('matches.noMatchesYet')}
          </Text>
          <Text className="mt-1 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('matches.noMatchesYetDescription')}
          </Text>
        </View>
      ) : (
        // Wider brackets (8+ teams) overflow phone width — let the user
        // pan horizontally instead of clipping or shrinking the layout.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          className="mt-4 -mx-5"
          contentContainerClassName="px-5 pb-6"
        >
          <BracketTree
            matches={bracketMatches}
            participantsById={participantsById}
          />
        </ScrollView>
      )}
    </Screen>
  );
}
