import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import {
  INITIAL_CUSTOM_PHASES,
  PhaseBuilder,
  WORLD_CUP_PHASES,
} from '@/components/PhaseBuilder';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import {
  TournamentTypePicker,
  type PickerOption,
} from '@/components/TournamentTypePicker';
import { useThemeIcon } from '@/hooks/useThemeIcon';
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

function defaultScoringFor(type: PickerOption): ScoringRule {
  // The vôlei preset starts with FIVB scoring; other presets start FIFA.
  // User can override before creating.
  return type === 'league_playoff' ? 'volleyball' : 'fifa';
}

/** Resolve the picker option to the real DB tournament type. Templates
 *  like 'world_cup' map to 'custom' under the hood. */
function realType(option: PickerOption): TournamentType {
  return option === 'world_cup' ? 'custom' : option;
}

/** True for any picker option that drives a custom-phases tournament — i.e.
 *  the user-defined builder OR one of the pre-filled templates. */
function usesCustomPhases(option: PickerOption): boolean {
  return option === 'custom' || option === 'world_cup';
}

export default function NewTournamentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const icon = useThemeIcon();
  const add = useTournamentsStore((s) => s.add);

  const [name, setName] = useState('');
  const [type, setType] = useState<PickerOption>('single_elimination');
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
    // Templates pre-fill the phase builder so the user lands on a fully
    // configured starting point. Switching back to plain "Personalizado"
    // resets to a single empty round-robin phase.
    if (type === 'world_cup') setCustomPhases(WORLD_CUP_PHASES);
    else if (type === 'custom') setCustomPhases(INITIAL_CUSTOM_PHASES);
  }, [type]);

  const showScoringPicker =
    type !== 'world_cup' &&
    type !== 'custom' &&
    PRESETS_WITH_STANDINGS.includes(type as TournamentType);
  const showPhaseBuilder = usesCustomPhases(type);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError(t('newTournament.validationName'));
      return;
    }
    setError(undefined);

    if (showPhaseBuilder) {
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
        type: realType(type),
        customPhases: showPhaseBuilder ? customPhases : undefined,
        scoring: showScoringPicker ? scoring : undefined,
      });
      router.back();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
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
          <ChevronLeft size={22} color={icon.secondary} />
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

        {showPhaseBuilder ? (
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
        case 'single_elim_qualifiers_unsupported':
          return t('phaseBuilder.errors.singleElimQualifiersUnsupported', {
            got: e.got,
          });
        case 'single_elim_multi_group_unsupported':
          return t('phaseBuilder.errors.singleElimMultiGroupUnsupported');
        case 'second_phase_must_not_be_round_robin':
          return t('phaseBuilder.errors.secondPhaseMustNotBeRoundRobin');
        case 'double_elim_must_be_standalone':
          return t('phaseBuilder.errors.doubleElimMustBeStandalone');
      }
    })
    .join('\n');
}
