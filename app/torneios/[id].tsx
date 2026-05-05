import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Trash2 } from 'lucide-react-native';

import { ParticipantList } from '@/components/ParticipantList';
import { Tabs } from '@/components/Tabs';
import { Screen } from '@/components/ui/Screen';
import { useTranslation } from '@/i18n/useTranslation';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useTournamentsStore } from '@/stores/useTournamentsStore';
import type { Tournament, TournamentType } from '@/types/tournament';

type TabKey = 'participants' | 'matches' | 'bracket';

const TYPE_LABEL_KEY: Record<TournamentType, string> = {
  single_elimination: 'singleElimination',
  round_robin: 'roundRobin',
  groups_knockout: 'groupsKnockout',
};

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = Number(id);
  const { t } = useTranslation();
  const router = useRouter();

  const fetchById = useTournamentsStore((s) => s.fetchById);
  const remove = useTournamentsStore((s) => s.remove);
  const tournament = useTournamentsStore((s) =>
    s.tournaments.find((tt) => tt.id === tournamentId)
  );
  const clearParticipants = useParticipantsStore(
    (s) => s.clearForTournament
  );

  const [activeTab, setActiveTab] = useState<TabKey>('participants');
  const [loadAttempted, setLoadAttempted] = useState(false);

  useEffect(() => {
    if (Number.isFinite(tournamentId)) {
      fetchById(tournamentId).finally(() => setLoadAttempted(true));
    } else {
      setLoadAttempted(true);
    }
  }, [tournamentId, fetchById]);

  const handleDelete = () => {
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
  };

  if (loadAttempted && !tournament) {
    return (
      <Screen>
        <Header title={t('tournament.notFound')} onBack={() => router.back()} />
      </Screen>
    );
  }

  if (!tournament) {
    return <Screen />;
  }

  return (
    <Screen>
      <HeaderWithActions
        tournament={tournament}
        onBack={() => router.back()}
        onDelete={handleDelete}
      />

      <View className="my-4">
        <Tabs<TabKey>
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'participants', label: t('tournament.participants') },
            { key: 'matches', label: t('tournament.matches') },
            { key: 'bracket', label: t('tournament.bracket') },
          ]}
        />
      </View>

      <View className="flex-1">
        {activeTab === 'participants' ? (
          <ParticipantList tournamentId={tournamentId} />
        ) : (
          <ComingSoon label={t('tournament.comingSoon')} />
        )}
      </View>
    </Screen>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
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

function HeaderWithActions({
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

function ComingSoon({ label }: { label: string }) {
  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-base text-slate-500 dark:text-slate-400">
        {label}
      </Text>
    </View>
  );
}
