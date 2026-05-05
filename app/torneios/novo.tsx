import { useEffect, useState } from 'react';
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
import type {
  CustomPhaseInput,
  ScoringRule,
  TournamentType,
} from '@/types/tournament';
import {
  validateCustomPhases,
  type ValidationError,
} from '@/utils/customPhaseValidation';

/** Presets that produce standings → need a scoring rule.
 *  single_elimination has no league phase; custom configures per-phase. */
const PRESETS_WITH_STANDINGS: TournamentType[] = [
  'round_robin',
  'groups_knockout',
  'league_playoff',
];

function defaultScoringFor(type: TournamentType): ScoringRule {
  // The vôlei preset starts with FIVB scoring; other presets start FIFA.
  // User can override before creating.
  return type === 'league_playoff' ? 'volleyball' : 'fifa';
}

export default function NewTournamentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const add = useTournamentsStore((s) => s.add);

  const [name, setName] = useState('');
  const [type, setType] = useState<TournamentType>('single_elimination');
  const [scoring, setScoring] = useState<ScoringRule>('fifa');
  const [customPhases, setCustomPhases] = useState<CustomPhaseInput[]>(
    INITIAL_CUSTOM_PHASES
  );
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  // When the user changes the preset, reset scoring to that preset's
  // sensible default. They can still override before creating.
  useEffect(() => {
    setScoring(defaultScoringFor(type));
  }, [type]);

  const showScoringPicker = PRESETS_WITH_STANDINGS.includes(type);

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
        scoring: showScoringPicker ? scoring : undefined,
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

        {showScoringPicker ? (
          <View className="gap-2">
            <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('newTournament.scoring')}
            </Text>
            <View className="flex-row gap-2">
              <ScoringOption
                label={t('phaseBuilder.scoringFifa')}
                selected={scoring === 'fifa'}
                onPress={() => setScoring('fifa')}
              />
              <ScoringOption
                label={t('phaseBuilder.scoringVolleyball')}
                selected={scoring === 'volleyball'}
                onPress={() => setScoring('volleyball')}
              />
            </View>
          </View>
        ) : null}

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

function ScoringOption({
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
      className={`flex-1 rounded-xl border px-3 py-3 ${
        selected
          ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <Text
        className={`text-center text-sm ${
          selected
            ? 'font-semibold text-brand-700 dark:text-brand-200'
            : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {label}
      </Text>
    </Pressable>
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
