import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  Stack,
  useLocalSearchParams,
  usePathname,
  useRouter,
} from 'expo-router';
import { ChevronLeft, Trash2 } from 'lucide-react-native';

import { Screen } from '@/components/ui/Screen';
import { useTranslation } from '@/i18n/useTranslation';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useTournamentsStore } from '@/stores/useTournamentsStore';
import type { Tournament, TournamentType } from '@/types/tournament';

const TYPE_LABEL_KEY: Record<TournamentType, string> = {
  single_elimination: 'singleElimination',
  round_robin: 'roundRobin',
  groups_knockout: 'groupsKnockout',
};

type TabKey = 'index' | 'partidas' | 'chaveamento';

export default function TournamentDetailLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const fetchById = useTournamentsStore((s) => s.fetchById);
  const remove = useTournamentsStore((s) => s.remove);
  const tournament = useTournamentsStore((s) =>
    s.tournaments.find((tt) => tt.id === tournamentId)
  );
  const clearParticipants = useParticipantsStore(
    (s) => s.clearForTournament
  );

  const [loadAttempted, setLoadAttempted] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) {
      setLoadAttempted(true);
      return;
    }
    let cancelled = false;
    fetchById(tournamentId).finally(() => {
      if (!cancelled) setLoadAttempted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, fetchById]);

  const handleBack = useCallback(() => router.back(), [router]);

  const handleDelete = useCallback(() => {
    Alert.alert(t('tournament.deleteTitle'), t('tournament.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await remove(tournamentId);
          clearParticipants(tournamentId);
          router.back();
        },
      },
    ]);
  }, [t, remove, clearParticipants, tournamentId, router]);

  const activeTab: TabKey = pathname.endsWith('/partidas')
    ? 'partidas'
    : pathname.endsWith('/chaveamento')
      ? 'chaveamento'
      : 'index';

  const goTab = useCallback(
    (key: TabKey) => {
      const map: Record<TabKey, string> = {
        index: '',
        partidas: '/partidas',
        chaveamento: '/chaveamento',
      };
      router.replace(`/torneios/${tournamentId}${map[key]}` as never);
    },
    [router, tournamentId]
  );

  if (loadAttempted && !tournament) {
    return (
      <Screen>
        <NotFoundHeader title={t('tournament.notFound')} onBack={handleBack} />
      </Screen>
    );
  }

  if (!tournament) {
    return <Screen />;
  }

  return (
    <Screen>
      <Header
        tournament={tournament}
        onBack={handleBack}
        onDelete={handleDelete}
      />
      <View className="my-4 flex-row rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        <TabButton
          label={t('tournament.participants')}
          selected={activeTab === 'index'}
          onPress={() => goTab('index')}
        />
        <TabButton
          label={t('tournament.matches')}
          selected={activeTab === 'partidas'}
          onPress={() => goTab('partidas')}
        />
        <TabButton
          label={t('tournament.bracket')}
          selected={activeTab === 'chaveamento'}
          onPress={() => goTab('chaveamento')}
        />
      </View>
      <View className="flex-1">
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </View>
    </Screen>
  );
}

function TabButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center justify-center rounded-xl px-3 py-2 ${
        selected ? 'bg-white shadow-sm dark:bg-slate-700' : ''
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          selected
            ? 'text-slate-900 dark:text-white'
            : 'text-slate-600 dark:text-slate-400'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Header({
  tournament,
  onBack,
  onDelete,
}: {
  tournament: Tournament;
  onBack: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="pt-6">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onBack}
          className="-ml-2 rounded-full p-2 active:bg-slate-100 dark:active:bg-slate-800"
        >
          <ChevronLeft size={22} color="#475569" />
        </Pressable>
        <Pressable
          onPress={onDelete}
          className="-mr-2 rounded-full p-2 active:bg-red-50 dark:active:bg-red-950"
        >
          <Trash2 size={20} color="#dc2626" />
        </Pressable>
      </View>
      <Text className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
        {tournament.name}
      </Text>
      <View className="mt-2 flex-row gap-2">
        <Badge tone="brand">
          {t(`newTournament.types.${TYPE_LABEL_KEY[tournament.type]}`)}
        </Badge>
        <Badge tone="neutral">
          {t(`tournament.status.${tournament.status}`)}
        </Badge>
      </View>
    </View>
  );
}

function NotFoundHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View className="flex-row items-center pt-6">
      <Pressable
        onPress={onBack}
        className="-ml-2 mr-2 rounded-full p-2 active:bg-slate-100 dark:active:bg-slate-800"
      >
        <ChevronLeft size={22} color="#475569" />
      </Pressable>
      <Text className="text-xl font-bold text-slate-900 dark:text-white">
        {title}
      </Text>
    </View>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'brand' | 'neutral';
}) {
  const styles =
    tone === 'brand'
      ? {
          container: 'bg-brand-50 dark:bg-brand-950',
          text: 'text-brand-700 dark:text-brand-200',
        }
      : {
          container: 'bg-slate-100 dark:bg-slate-800',
          text: 'text-slate-700 dark:text-slate-300',
        };
  return (
    <View className={`rounded-full px-2.5 py-1 ${styles.container}`}>
      <Text className={`text-xs font-semibold ${styles.text}`}>
        {children}
      </Text>
    </View>
  );
}
