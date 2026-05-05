import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { Screen } from '@/components/ui/Screen';
import { useTranslation } from '@/i18n/useTranslation';

export default function MatchesScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Screen>
      <View className="flex-row items-center pt-6">
        <Pressable
          onPress={() => router.back()}
          className="-ml-2 mr-2 rounded-full p-2 active:bg-slate-100 dark:active:bg-slate-800"
        >
          <ChevronLeft size={22} color="#475569" />
        </Pressable>
        <Text className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('tournament.matches')}
        </Text>
      </View>

      <View className="flex-1 items-center justify-center">
        <Text className="text-base text-slate-500 dark:text-slate-400">
          {t('tournament.comingSoon')}
        </Text>
      </View>
    </Screen>
  );
}
