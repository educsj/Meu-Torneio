import { useEffect } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Trophy } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useTranslation } from '@/i18n/useTranslation';
import { useTournamentsStore } from '@/stores/useTournamentsStore';

export default function TournamentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const tournaments = useTournamentsStore((s) => s.tournaments);
  const refresh = useTournamentsStore((s) => s.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
          <Card
            onPress={() =>
              router.push({
                pathname: '/torneios/[id]',
                params: { id: String(item.id) },
              })
            }
          >
            <Text className="text-base font-semibold text-slate-900 dark:text-white">
              {item.name}
            </Text>
            <Text className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t(`tournament.status.${item.status}`)}
            </Text>
          </Card>
        )}
      />

      <View className="absolute bottom-6 left-5 right-5">
        <Button
          label={t('home.newTournament')}
          onPress={() => router.push('/torneios/novo')}
          leading={<Plus size={18} color="#fff" />}
        />
      </View>
    </Screen>
  );
}
