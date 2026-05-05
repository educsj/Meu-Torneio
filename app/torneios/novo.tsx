import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TournamentTypePicker } from '@/components/TournamentTypePicker';
import { useTranslation } from '@/i18n/useTranslation';
import { useTournamentsStore } from '@/stores/useTournamentsStore';
import type { TournamentType } from '@/types/tournament';

export default function NewTournamentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const add = useTournamentsStore((s) => s.add);

  const [name, setName] = useState('');
  const [type, setType] = useState<TournamentType>('single_elimination');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError(t('newTournament.validationName'));
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await add({ name: name.trim(), type });
      router.back();
    } catch (err) {
      Alert.alert('Erro', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <View className="flex-row items-center pt-6">
        <Pressable
          onPress={() => router.back()}
          className="-ml-2 mr-2 rounded-full p-2 active:bg-slate-100 dark:active:bg-slate-800"
        >
          <ChevronLeft size={22} color="#475569" />
        </Pressable>
        <Text className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('newTournament.title')}
        </Text>
      </View>

      <View className="mt-6 gap-6">
        <TextField
          label={t('newTournament.name')}
          placeholder={t('newTournament.namePlaceholder')}
          value={name}
          onChangeText={setName}
          error={error}
          autoFocus
        />

        <View className="gap-2">
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('newTournament.type')}
          </Text>
          <TournamentTypePicker value={type} onChange={setType} />
        </View>

        <Button
          label={t('newTournament.create')}
          onPress={onSubmit}
          disabled={submitting}
        />
      </View>
    </Screen>
  );
}
