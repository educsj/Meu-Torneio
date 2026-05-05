import { Plus, Trash2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTranslation } from '@/i18n/useTranslation';
import type {
  CustomPhaseInput,
  PhaseFormat,
  ScoringRule,
} from '@/types/tournament';

interface Props {
  value: CustomPhaseInput[];
  onChange: (phases: CustomPhaseInput[]) => void;
}

const DEFAULT_PHASE: CustomPhaseInput = {
  name: 'Fase 1',
  format: 'round_robin',
  legs: 1,
  groupCount: 1,
  qualifiers: null,
  scoring: 'fifa',
};

const FORMAT_KEYS: { value: PhaseFormat; key: string }[] = [
  { value: 'round_robin', key: 'roundRobin' },
  { value: 'single_elimination', key: 'singleElimination' },
  { value: 'placement_playoff', key: 'placementPlayoff' },
];

const MAX_PHASES = 2;

export function PhaseBuilder({ value, onChange }: Props) {
  const { t } = useTranslation();

  const update = (index: number, partial: Partial<CustomPhaseInput>) => {
    const next = value.map((p, i) =>
      i === index ? { ...p, ...partial } : p
    );
    onChange(next);
  };

  const addPhase = () => {
    if (value.length >= MAX_PHASES) return;
    // When adding a 2nd phase, the previous one must qualify SOMEONE.
    // Default to 4 qualifiers (matches both presets currently supported).
    const updatedFirst =
      value.length > 0 && value[0].qualifiers == null
        ? { ...value[0], qualifiers: 4 }
        : value[0];
    onChange([
      updatedFirst ?? DEFAULT_PHASE,
      {
        name: `Fase ${value.length + 1}`,
        format: 'placement_playoff',
        legs: 1,
        groupCount: 1,
        qualifiers: null,
        scoring: 'fifa',
      },
    ]);
  };

  const removePhase = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    // Last phase always has qualifiers=null (nothing to qualify for).
    if (next.length > 0) {
      next[next.length - 1] = { ...next[next.length - 1], qualifiers: null };
    }
    onChange(next);
  };

  return (
    <View className="gap-4">
      {value.map((phase, index) => {
        const isLast = index === value.length - 1;
        return (
          <View
            key={index}
            className="gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t('phaseBuilder.phaseN', { n: index + 1 })}
              </Text>
              {value.length > 1 ? (
                <Pressable
                  onPress={() => removePhase(index)}
                  className="rounded-full p-1.5 active:bg-red-50 dark:active:bg-red-950"
                >
                  <Trash2 size={16} color="#dc2626" />
                </Pressable>
              ) : null}
            </View>

            <FormatPicker
              value={phase.format}
              onChange={(format) => update(index, { format })}
              t={t}
            />

            {phase.format === 'round_robin' ? (
              <>
                <ToggleRow
                  label={t('phaseBuilder.legsLabel')}
                  options={[
                    { value: 1, label: t('phaseBuilder.legsSingle') },
                    { value: 2, label: t('phaseBuilder.legsDouble') },
                  ]}
                  selected={phase.legs}
                  onChange={(legs) =>
                    update(index, { legs: legs as 1 | 2 })
                  }
                />
                <Stepper
                  label={t('phaseBuilder.groupCount')}
                  value={phase.groupCount}
                  min={1}
                  max={4}
                  onChange={(groupCount) => update(index, { groupCount })}
                />
                <ToggleRow
                  label={t('phaseBuilder.scoringLabel')}
                  options={[
                    {
                      value: 'fifa',
                      label: t('phaseBuilder.scoringFifa'),
                    },
                    {
                      value: 'volleyball',
                      label: t('phaseBuilder.scoringVolleyball'),
                    },
                  ]}
                  selected={phase.scoring}
                  onChange={(scoring) =>
                    update(index, { scoring: scoring as ScoringRule })
                  }
                />
              </>
            ) : null}

            {!isLast ? (
              <Stepper
                label={t('phaseBuilder.qualifiers')}
                value={phase.qualifiers ?? 4}
                min={2}
                max={16}
                step={2}
                onChange={(qualifiers) => update(index, { qualifiers })}
              />
            ) : null}
          </View>
        );
      })}

      {value.length < MAX_PHASES ? (
        <Pressable
          onPress={addPhase}
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 p-3 active:bg-slate-50 dark:border-slate-700 dark:active:bg-slate-900"
        >
          <Plus size={16} color="#475569" />
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('phaseBuilder.addPhase')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FormatPicker({
  value,
  onChange,
  t,
}: {
  value: PhaseFormat;
  onChange: (v: PhaseFormat) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {t('phaseBuilder.format')}
      </Text>
      <View className="flex-row gap-2">
        {FORMAT_KEYS.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className={`flex-1 rounded-xl border px-2 py-2 ${
                selected
                  ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              <Text
                className={`text-center text-xs font-medium ${
                  selected
                    ? 'text-brand-700 dark:text-brand-200'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {t(`phaseBuilder.formats.${opt.key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow<T extends number | string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </Text>
      <View className="flex-row gap-2">
        {options.map((opt) => {
          const isSelected = opt.value === selected;
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              className={`flex-1 rounded-xl border px-3 py-2 ${
                isSelected
                  ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              <Text
                className={`text-center text-sm ${
                  isSelected
                    ? 'font-semibold text-brand-700 dark:text-brand-200'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const decrement = () => {
    if (value - step >= min) onChange(value - step);
  };
  const increment = () => {
    if (value + step <= max) onChange(value + step);
  };
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </Text>
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={decrement}
          disabled={value - step < min}
          className={`h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 ${
            value - step < min ? 'opacity-40' : 'active:bg-slate-100'
          }`}
        >
          <Text className="text-lg font-semibold text-slate-700 dark:text-slate-300">
            −
          </Text>
        </Pressable>
        <Text className="min-w-[32px] text-center text-base font-semibold text-slate-900 dark:text-slate-100">
          {value}
        </Text>
        <Pressable
          onPress={increment}
          disabled={value + step > max}
          className={`h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 ${
            value + step > max ? 'opacity-40' : 'active:bg-slate-100'
          }`}
        >
          <Text className="text-lg font-semibold text-slate-700 dark:text-slate-300">
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export const INITIAL_CUSTOM_PHASES: CustomPhaseInput[] = [DEFAULT_PHASE];
