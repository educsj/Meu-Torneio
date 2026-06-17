import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BarChart3 } from 'lucide-react-native';

import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { listAllScorerEntries } from '@/db/scorers';
import { loadAllTournamentBundles } from '@/db/stats';
import { useTranslation } from '@/i18n/useTranslation';
import {
  aggregateParticipantStats,
  aggregateScorers,
  type AggregateStatRow,
  type ScorerEntry,
  type TopScorerRow,
  type TournamentBundle,
} from '@/utils/stats';

type SortKey = 'goalsFor' | 'wins' | 'titles';
type StatsView = 'overall' | 'scorers';

export default function StatisticsScreen() {
  const { t } = useTranslation();
  const [bundles, setBundles] = useState<TournamentBundle[] | null>(null);
  const [scorerEntries, setScorerEntries] = useState<ScorerEntry[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('goalsFor');
  const [view, setView] = useState<StatsView>('overall');

  // Reload every time the tab regains focus — stats change as the user enters
  // scores and finishes tournaments elsewhere in the app.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([loadAllTournamentBundles(), listAllScorerEntries()]).then(
        ([list, scorers]) => {
          if (cancelled) return;
          setBundles(list);
          setScorerEntries(scorers);
        }
      );
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const rows = useMemo(
    () => (bundles ? aggregateParticipantStats(bundles, sortBy) : []),
    [bundles, sortBy]
  );
  const topScorers = useMemo(
    () => aggregateScorers(scorerEntries),
    [scorerEntries]
  );

  const hasData = rows.some((r) => r.played > 0 || r.titles > 0);

  return (
    <Screen scroll>
      <View className="pb-2 pt-6">
        <Text className="text-3xl font-bold text-slate-900 dark:text-white">
          {t('statistics.title')}
        </Text>
        <Text className="mt-1 text-base text-slate-600 dark:text-slate-400">
          {t('statistics.subtitle')}
        </Text>
      </View>

      {bundles == null ? (
        <View className="mt-4">
          <SkeletonList rows={6} />
        </View>
      ) : (
        <>
          <View className="mt-2 flex-row gap-2">
            <SortChip
              label={t('statistics.viewOverall')}
              active={view === 'overall'}
              onPress={() => setView('overall')}
            />
            <SortChip
              label={t('statistics.viewScorers')}
              active={view === 'scorers'}
              onPress={() => setView('scorers')}
            />
          </View>

          {view === 'overall' ? (
            !hasData ? (
              <EmptyState
                icon={<BarChart3 size={32} color="#94a3b8" />}
                title={t('statistics.empty')}
                description={t('statistics.emptyDescription')}
              />
            ) : (
              <>
                <View className="mt-3 flex-row gap-2">
                  <SortChip
                    label={t('statistics.sortGoals')}
                    active={sortBy === 'goalsFor'}
                    onPress={() => setSortBy('goalsFor')}
                  />
                  <SortChip
                    label={t('statistics.sortWins')}
                    active={sortBy === 'wins'}
                    onPress={() => setSortBy('wins')}
                  />
                  <SortChip
                    label={t('statistics.sortTitles')}
                    active={sortBy === 'titles'}
                    onPress={() => setSortBy('titles')}
                  />
                </View>

                <View className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      <HeaderRow t={t} />
                      {rows.map((row, idx) => (
                        <Row key={row.name} row={row} position={idx + 1} />
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <Text className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                  {t('statistics.note')}
                </Text>
              </>
            )
          ) : topScorers.length === 0 ? (
            <EmptyState
              icon={<BarChart3 size={32} color="#94a3b8" />}
              title={t('statistics.scorersEmpty')}
              description={t('statistics.scorersEmptyDescription')}
            />
          ) : (
            <View className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <ScorerHeaderRow t={t} />
              {topScorers.map((row, idx) => (
                <ScorerRow key={row.name} row={row} position={idx + 1} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <View className="mt-16 items-center px-6">
      <View className="mb-4 rounded-full bg-slate-100 p-5 dark:bg-slate-800">
        {icon}
      </View>
      <Text className="text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </Text>
      <Text className="mt-1 text-center text-sm text-slate-600 dark:text-slate-400">
        {description}
      </Text>
    </View>
  );
}

function ScorerHeaderRow({
  t,
}: {
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <View className="flex-row items-center bg-slate-50 px-3 py-2 dark:bg-slate-900">
      <Text className="w-6 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        #
      </Text>
      <Text className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t('statistics.colPlayer')}
      </Text>
      <Stat label={t('statistics.colGoals')} />
      <Stat label={t('statistics.colMatches')} />
      <Stat label={t('statistics.colTournaments')} />
    </View>
  );
}

function ScorerRow({
  row,
  position,
}: {
  row: TopScorerRow;
  position: number;
}) {
  return (
    <View
      className={`flex-row items-center border-t border-slate-100 px-3 py-2.5 dark:border-slate-800 ${
        position === 1 ? 'bg-brand-50/50 dark:bg-brand-950/30' : ''
      }`}
    >
      <Text className="w-6 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
        {position}
      </Text>
      <Text
        className="flex-1 pr-2 text-sm text-slate-900 dark:text-slate-100"
        numberOfLines={1}
      >
        {row.name}
      </Text>
      <Cell value={row.goals} bold={position === 1} />
      <Cell value={row.matches} />
      <Cell value={row.tournaments} />
    </View>
  );
}

function SortChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-xl border px-3 py-2 ${
        active
          ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <Text
        className={`text-center text-sm ${
          active
            ? 'font-semibold text-brand-700 dark:text-brand-200'
            : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function HeaderRow({
  t,
}: {
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <View className="flex-row items-center bg-slate-50 px-3 py-2 dark:bg-slate-900">
      <Text className="w-6 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        #
      </Text>
      <Text className="w-32 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t('statistics.colName')}
      </Text>
      <Stat label={t('statistics.colTitles')} />
      <Stat label={t('statistics.colTournaments')} />
      <Stat label={t('statistics.colPlayed')} />
      <Stat label={t('statistics.colWins')} />
      <Stat label={t('statistics.colDraws')} />
      <Stat label={t('statistics.colLosses')} />
      <Stat label={t('statistics.colGoalsFor')} />
      <Stat label={t('statistics.colGoalDiff')} />
    </View>
  );
}

function Row({ row, position }: { row: AggregateStatRow; position: number }) {
  return (
    <View
      className={`flex-row items-center border-t border-slate-100 px-3 py-2.5 dark:border-slate-800 ${
        position === 1 ? 'bg-brand-50/50 dark:bg-brand-950/30' : ''
      }`}
    >
      <Text className="w-6 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
        {position}
      </Text>
      <Text
        className="w-32 pr-2 text-sm text-slate-900 dark:text-slate-100"
        numberOfLines={1}
      >
        {row.name}
      </Text>
      <Cell value={row.titles} bold={row.titles > 0} />
      <Cell value={row.tournaments} />
      <Cell value={row.played} />
      <Cell value={row.wins} />
      <Cell value={row.draws} />
      <Cell value={row.losses} />
      <Cell value={row.goalsFor} />
      <Cell
        value={row.goalDiff > 0 ? `+${row.goalDiff}` : String(row.goalDiff)}
      />
    </View>
  );
}

function Stat({ label }: { label: string }) {
  return (
    <Text className="w-10 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {label}
    </Text>
  );
}

function Cell({
  value,
  bold = false,
}: {
  value: number | string;
  bold?: boolean;
}) {
  return (
    <Text
      className={`w-10 text-center text-sm font-mono ${
        bold
          ? 'font-bold text-amber-600 dark:text-amber-400'
          : 'text-slate-700 dark:text-slate-300'
      }`}
    >
      {value}
    </Text>
  );
}
