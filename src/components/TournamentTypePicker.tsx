import { Pressable, Text, View } from 'react-native';

import { useTranslation } from '@/i18n/useTranslation';
import type { TournamentType } from '@/types/tournament';

const OPTIONS: { value: TournamentType; key: string }[] = [
  { value: 'single_elimination', key: 'singleElimination' },
  { value: 'round_robin', key: 'roundRobin' },
  { value: 'groups_knockout', key: 'groupsKnockout' },
];

interface Props {
  value: TournamentType;
  onChange: (value: TournamentType) => void;
}

export function TournamentTypePicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      {OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`rounded-2xl border p-4 ${
              selected
                ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                selected
                  ? 'text-brand-700 dark:text-brand-200'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {t(`newTournament.types.${opt.key}`)}
            </Text>
            <Text className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t(`newTournament.typesDescription.${opt.key}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
