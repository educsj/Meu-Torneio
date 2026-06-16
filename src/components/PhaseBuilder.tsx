import { Plus, Trash2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTranslation } from '@/i18n/useTranslation';
import type {
  CustomPhaseInput,
  PhaseFormat,
  ScoringRule,
  TiebreakerPreset,
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
  tiebreaker: 'fifa',
  thirdPlace: false,
  bracketReset: false,
};

const TIEBREAKER_KEYS: { value: TiebreakerPreset; key: string }[] = [
  { value: 'fifa', key: 'fifa' },
  { value: 'conmebol', key: 'conmebol' },
  { value: 'volleyball', key: 'volleyball' },
];

const FORMAT_KEYS: { value: PhaseFormat; key: string }[] = [
  { value: 'round_robin', key: 'roundRobin' },
  { value: 'single_elimination', key: 'singleElimination' },
  { value: 'double_elimination', key: 'doubleElimination' },
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

  // Changing the SECOND phase's format can invalidate the FIRST phase's
  // qualifiers (e.g. PP allows odd numbers, SE requires power-of-2 / 2×groupCount).
  // Snap them in the same update so the UI never shows a stale invalid value.
  const updateSecondPhaseFormat = (format: PhaseFormat) => {
    if (value.length < 2) return;
    const first = value[0];
    let firstPatched = first;
    if (format === 'single_elimination') {
      if (first.groupCount > 1) {
        firstPatched = { ...first, qualifiers: first.groupCount * 2 };
      } else {
        const q = first.qualifiers ?? 4;
        const valid = [2, 4, 8, 16];
        const snapped = valid.reduce(
          (best, v) => (Math.abs(v - q) < Math.abs(best - q) ? v : best),
          4
        );
        firstPatched = { ...first, qualifiers: snapped };
      }
    } else if (format === 'placement_playoff') {
      const q = first.qualifiers ?? 4;
      // PP requires even qualifiers ≥ 2.
      const evened = q % 2 === 0 ? q : q + 1;
      firstPatched = { ...first, qualifiers: Math.max(2, evened) };
    }
    onChange([firstPatched, { ...value[1], format }]);
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
        tiebreaker: 'fifa',
        thirdPlace: false,
        bracketReset: false,
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
              onChange={(format) => {
                if (index === 1) updateSecondPhaseFormat(format);
                else update(index, { format });
              }}
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
                  max={8}
                  onChange={(groupCount) => {
                    const next = value[index + 1];
                    // Multi-group → SE: top-2 from each group qualifies, so
                    // qualifiers is fully derived from groupCount. Keep them
                    // in sync automatically so the user can't desync them.
                    if (
                      next &&
                      next.format === 'single_elimination' &&
                      groupCount > 1
                    ) {
                      update(index, {
                        groupCount,
                        qualifiers: groupCount * 2,
                      });
                    } else {
                      update(index, { groupCount });
                    }
                  }}
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
                <TiebreakerPicker
                  value={phase.tiebreaker}
                  onChange={(tiebreaker) => update(index, { tiebreaker })}
                  t={t}
                />
              </>
            ) : null}

            {!isLast ? (
              <QualifiersField
                phase={phase}
                nextFormat={value[index + 1]?.format}
                onChange={(qualifiers) => update(index, { qualifiers })}
                t={t}
              />
            ) : null}

            {phase.format === 'single_elimination' ? (
              <ThirdPlaceToggle
                value={phase.thirdPlace}
                onChange={(thirdPlace) => update(index, { thirdPlace })}
                t={t}
              />
            ) : null}

            {phase.format === 'double_elimination' ? (
              <BracketResetToggle
                value={phase.bracketReset}
                onChange={(bracketReset) => update(index, { bracketReset })}
                t={t}
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

function TiebreakerPicker({
  value,
  onChange,
  t,
}: {
  value: TiebreakerPreset;
  onChange: (v: TiebreakerPreset) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {t('phaseBuilder.tiebreakerLabel')}
      </Text>
      <View className="flex-row gap-2">
        {TIEBREAKER_KEYS.map((opt) => {
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
                {t(`tiebreaker.${opt.key}.name`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="text-[11px] text-slate-500 dark:text-slate-400">
        {t(`tiebreaker.${value}.order`)}
      </Text>
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

function BracketResetToggle({
  value,
  onChange,
  t,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-800"
    >
      <View className="flex-1 pr-3">
        <Text className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {t('phaseBuilder.bracketResetLabel')}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t('phaseBuilder.bracketResetHint')}
        </Text>
      </View>
      <View
        className={`h-6 w-11 rounded-full p-0.5 ${
          value
            ? 'bg-brand-500 dark:bg-brand-400'
            : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <View
          className={`h-5 w-5 rounded-full bg-white shadow ${
            value ? 'ml-5' : ''
          }`}
        />
      </View>
    </Pressable>
  );
}

function ThirdPlaceToggle({
  value,
  onChange,
  t,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-800"
    >
      <View className="flex-1 pr-3">
        <Text className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {t('phaseBuilder.thirdPlaceLabel')}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t('phaseBuilder.thirdPlaceHint')}
        </Text>
      </View>
      <View
        className={`h-6 w-11 rounded-full p-0.5 ${
          value
            ? 'bg-brand-500 dark:bg-brand-400'
            : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <View
          className={`h-5 w-5 rounded-full bg-white shadow ${
            value ? 'ml-5' : ''
          }`}
        />
      </View>
    </Pressable>
  );
}

function QualifiersField({
  phase,
  nextFormat,
  onChange,
  t,
}: {
  phase: CustomPhaseInput;
  nextFormat: PhaseFormat | undefined;
  onChange: (q: number) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  // Multi-group → single-elim: top-2 from each group, fully derived.
  // Show as read-only with explanatory hint instead of an editable stepper.
  if (
    nextFormat === 'single_elimination' &&
    phase.format === 'round_robin' &&
    phase.groupCount > 1
  ) {
    const computed = phase.groupCount * 2;
    return (
      <View className="gap-1.5">
        <Text className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {t('phaseBuilder.qualifiers')}
        </Text>
        <View className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
          <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {computed}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {t('phaseBuilder.qualifiersHintTopTwo', {
              groups: phase.groupCount,
              total: computed,
            })}
          </Text>
        </View>
      </View>
    );
  }
  // Single league → single-elim: bracket needs power-of-two qualifiers.
  // Restrict the picker to {2,4,8,16} so the user can't land on an
  // invalid value via the stepper.
  if (nextFormat === 'single_elimination') {
    const value = phase.qualifiers ?? 4;
    return (
      <ToggleRow
        label={t('phaseBuilder.qualifiers')}
        options={[
          { value: 2, label: '2' },
          { value: 4, label: '4' },
          { value: 8, label: '8' },
          { value: 16, label: '16' },
        ]}
        selected={value}
        onChange={(v) => onChange(v as number)}
      />
    );
  }
  // Default (placement_playoff or no second phase): step-by-2 stepper.
  return (
    <Stepper
      label={t('phaseBuilder.qualifiers')}
      value={phase.qualifiers ?? 4}
      min={2}
      max={16}
      step={2}
      onChange={onChange}
    />
  );
}

export const INITIAL_CUSTOM_PHASES: CustomPhaseInput[] = [DEFAULT_PHASE];

/**
 * Pre-built phase template that mirrors a FIFA-World-Cup–style competition:
 * 8 groups of 4 with the top 2 advancing to a 16-team single-elimination
 * bracket (R16 → QF → SF → Final + 3rd-place). The user can still edit
 * any field after picking the template — it's a starter, not a fixed shape.
 */
export const WORLD_CUP_PHASES: CustomPhaseInput[] = [
  {
    name: 'Fase de Grupos',
    format: 'round_robin',
    legs: 1,
    groupCount: 8,
    qualifiers: 16,
    scoring: 'fifa',
    tiebreaker: 'fifa',
    thirdPlace: false,
    bracketReset: false,
  },
  {
    name: 'Mata-mata',
    format: 'single_elimination',
    legs: 1,
    groupCount: 1,
    qualifiers: null,
    scoring: 'fifa',
    tiebreaker: 'fifa',
    thirdPlace: true,
    bracketReset: false,
  },
];
