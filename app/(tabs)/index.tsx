import { useEffect } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Crown, Plus, Trophy } from 'lucide-react-native';

import { APP_BUILD_TAG } from '@/buildInfo';
import { ImportTournamentButton } from '@/components/BackupActions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useTranslation } from '@/i18n/useTranslation';
import { useTournamentsStore } from '@/stores/useTournamentsStore';
import type { Tournament } from '@/types/tournament';

export default function TournamentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const tournaments = useTournamentsStore((s) => s.tournaments);
  const refresh = useTournamentsStore((s) => s.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const goToTournament = (id: number) =>
    router.push({
      pathname: '/torneios/[id]',
      params: { id: String(id) },
    });

  return (
    <Screen>
      <View className="pb-4 pt-6">
        <Text className="text-3xl font-bold text-slate-900 dark:text-white">
          {t('home.title')}
        </Text>
        <Text className="mt-1 text-base text-slate-600 dark:text-slate-400">
          {t('home.subtitle')}
        </Text>
      </View>

      <View className="mb-3">
        <ImportTournamentButton
          onImported={(newId) => {
            refresh().then(() => goToTournament(newId));
          }}
        />
      </View>

      <FlatList
        data={tournaments}
        keyExtractor={(item) => String(item.id)}
        ItemSeparatorComponent={() => <View className="h-3" />}
        contentContainerStyle={{ paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="mt-12 items-center">
            <View className="mb-4 rounded-full bg-slate-100 p-5 dark:bg-slate-800">
              <Trophy size={36} color="#94a3b8" />
            </View>
            <Text className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('home.emptyTitle')}
            </Text>
            <Text className="mt-1 text-center text-slate-600 dark:text-slate-400">
              {t('home.emptyDescription')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TournamentCard tournament={item} onPress={() => goToTournament(item.id)} />
        )}
      />

      <View className="absolute bottom-6 left-5 right-5">
        <Button
          label={t('home.newTournament')}
          onPress={() => router.push('/torneios/novo')}
          leading={<Plus size={18} color="#fff" />}
        />
        <Text className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-600">
          {APP_BUILD_TAG}
        </Text>
      </View>
    </Screen>
  );
}

function TournamentCard({
  tournament,
  onPress,
}: {
  tournament: Tournament;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const isFinished = tournament.status === 'finished';
  const isOngoing = tournament.status === 'ongoing';

  return (
    <Card
      onPress={onPress}
      className={
        isFinished
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
          : ''
      }
    >
      <View className="flex-row items-center">
        {isFinished ? (
          <View className="mr-3 rounded-full bg-amber-100 p-2 dark:bg-amber-900/40">
            <Crown size={18} color="#d97706" />
          </View>
        ) : null}
        <View className="flex-1">
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {tournament.name}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            {isOngoing ? (
              <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            ) : null}
            <Text
              className={`text-xs uppercase tracking-wide ${
                isFinished
                  ? 'font-semibold text-amber-700 dark:text-amber-300'
                  : isOngoing
                    ? 'font-semibold text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t(`tournament.status.${tournament.status}`)}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}
