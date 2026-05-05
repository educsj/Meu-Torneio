import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { PhaseBuilder, INITIAL_CUSTOM_PHASES } from '@/components/PhaseBuilder';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TournamentTypePicker } from '@/components/TournamentTypePicker';
import { useTranslation } from '@/i18n/useTranslation';
import { useTournamentsStore } from '@/stores/useTournamentsStore';
import type { CustomPhaseInput, TournamentType } from '@/types/tournament';
import {
  validateCustomPhases,
  type ValidationError,
} from '@/utils/customPhaseValidation';

export default function NewTournamentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const add = useTournamentsStore((s) => s.add);

  const [name, setName] = useState('');
  const [type, setType] = useState<TournamentType>('single_elimination');
  const [customPhases, setCustomPhases] = useState<CustomPhaseInput[]>(
    INITIAL_CUSTOM_PHASES
  );
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError(t('newTournament.validationName'));
      return;
    }
    setError(undefined);

    if (type === 'custom') {
      const errors = validateCustomPhases(customPhases);
      if (errors.length > 0) {
        Alert.alert(
          t('newTournament.invalidPhasesTitle'),
          formatErrors(errors, t)
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      await add({
        name: name.trim(),
        type,
        customPhases: type === 'custom' ? customPhases : undefined,
      });
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

        {type === 'custom' ? (
          <View className="gap-2">
            <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('phaseBuilder.title')}
            </Text>
            <PhaseBuilder
              value={customPhases}
              onChange={setCustomPhases}
            />
          </View>
        ) : null}

        <Button
          label={t('newTournament.create')}
          onPress={onSubmit}
          disabled={submitting}
        />
      </View>
    </Screen>
  );
}

function formatErrors(
  errors: ValidationError[],
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  return errors
    .map((e) => {
      switch (e.code) {
        case 'no_phases':
          return t('phaseBuilder.errors.noPhases');
        case 'too_many_phases':
          return t('phaseBuilder.errors.tooManyPhases', { max: e.max });
        case 'last_phase_has_qualifiers':
          return t('phaseBuilder.errors.lastPhaseHasQualifiers');
        case 'first_phase_no_qualifiers':
          return t('phaseBuilder.errors.firstPhaseNoQualifiers');
        case 'qualifiers_must_be_even':
          return t('phaseBuilder.errors.qualifiersMustBeEven', {
            got: e.got,
          });
        case 'single_elim_qualifiers_must_be_4':
          return t('phaseBuilder.errors.singleElimQualifiersMustBe4', {
            got: e.got,
          });
        case 'second_phase_must_not_be_round_robin':
          return t('phaseBuilder.errors.secondPhaseMustNotBeRoundRobin');
      }
    })
    .join('\n');
}
