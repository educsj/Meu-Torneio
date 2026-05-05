import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { Screen } from '@/components/ui/Screen';

export default function MinimalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <Screen>
      <View className="flex-row items-center pt-6">
        <Pressable
          onPress={() => router.back()}
          className="-ml-2 mr-2 rounded-full p-2 active:bg-slate-100 dark:active:bg-slate-800"
        >
          <ChevronLeft size={22} color="#475569" />
        </Pressable>
        <Text className="text-xl font-bold text-slate-900 dark:text-white">
          MINIMAL DETAIL — id={String(id)}
        </Text>
      </View>

      <View className="mt-8 items-center">
        <Text className="text-base text-slate-700 dark:text-slate-300">
          If you can see this without crashing, the bug is in the previous
          detail screen layout — not in routing itself.
        </Text>
      </View>
    </Screen>
  );
}
