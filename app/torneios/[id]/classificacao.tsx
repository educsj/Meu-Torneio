import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ListOrdered } from 'lucide-react-native';

import { Screen } from '@/components/ui/Screen';
import { listParticipants } from '@/db/participants';
import { listPhases } from '@/db/phases';
import { useThemeIcon } from '@/hooks/useThemeIcon';
import { useTranslation } from '@/i18n/useTranslation';
import { useMatchesStore } from '@/stores/useMatchesStore';
import type {
  Match,
  Participant,
  ScoringRule,
} from '@/types/tournament';
import { computeStandings, type StandingRow } from '@/utils/standings';

const EMPTY_MATCHES: readonly Match[] = Object.freeze([]);

export default function StandingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const router = useRouter();
  const { t } = useTranslation();
  const icon = useThemeIcon();

  const matches = useMatchesStore(
    (s) => s.byTournament[tournamentId] ?? EMPTY_MATCHES
  ) as Match[];
  const load = useMatchesStore((s) => s.load);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [scoring, setScoring] = useState<ScoringRule>('fifa');

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    let cancelled = false;
    load(tournamentId);
    listParticipants(tournamentId).then((list) => {
      if (cancelled) return;
      setParticipants(list);
    });
    // Load the standings-producing phase to know which scoring rule to apply.
    // For all currently-supported configurations this is phase ordinal 0.
    listPhases(tournamentId).then((phases) => {
      if (cancelled) return;
      const source = phases.find((p) => p.ordinal === 0);
      if (source) setScoring(source.scoring);
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, load]);

  // Standings reflect only the league/group phase. Playoff matches
  // (stage='knockout') decide placement and shouldn't shift points/standings.
  const leagueMatches = useMemo(
    () => matches.filter((m) => m.stage !== 'knockout'),
    [matches]
  );

  const rows: StandingRow[] = useMemo(
    () => computeStandings(leagueMatches, participants, { scoring }),
    [leagueMatches, participants, scoring]
  );

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
          {t('standings.title')}
        </Text>
      </View>

      {participants.length === 0 ? (
        <View className="mt-16 items-center px-6">
          <View className="mb-4 rounded-full bg-slate-100 p-5 dark:bg-slate-800">
            <ListOrdered size={32} color="#94a3b8" />
          </View>
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {t('standings.empty')}
          </Text>
          <Text className="mt-1 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('standings.emptyDescription')}
          </Text>
        </View>
      ) : (
        <View className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <HeaderRow t={t} />
          {rows.map((row, idx) => (
            <Row key={row.participantId} row={row} position={idx + 1} />
          ))}
        </View>
      )}

      <View className="mt-4">
        <Legend t={t} scoring={scoring} />
      </View>
    </Screen>
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
      <Text className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t('standings.team')}
      </Text>
      <Stat label={t('standings.played')} />
      <Stat label={t('standings.wins')} />
      <Stat label={t('standings.draws')} />
      <Stat label={t('standings.losses')} />
      <Stat label={t('standings.goalDiff')} />
      <Stat label={t('standings.points')} bold />
    </View>
  );
}

function Row({ row, position }: { row: StandingRow; position: number }) {
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
        className="flex-1 text-sm text-slate-900 dark:text-slate-100"
        numberOfLines={1}
      >
        {row.name}
      </Text>
      <Cell value={row.played} />
      <Cell value={row.wins} />
      <Cell value={row.draws} />
      <Cell value={row.losses} />
      <Cell
        value={row.goalDiff > 0 ? `+${row.goalDiff}` : String(row.goalDiff)}
      />
      <Cell value={row.points} bold />
    </View>
  );
}

function Stat({ label, bold = false }: { label: string; bold?: boolean }) {
  return (
    <Text
      className={`w-9 text-center text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
        bold ? 'font-bold text-slate-700 dark:text-slate-300' : 'font-semibold'
      }`}
    >
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
      className={`w-9 text-center text-sm font-mono ${
        bold
          ? 'font-bold text-slate-900 dark:text-white'
          : 'text-slate-700 dark:text-slate-300'
      }`}
    >
      {value}
    </Text>
  );
}

function Legend({
  t,
  scoring,
}: {
  t: (key: string, options?: Record<string, unknown>) => string;
  scoring: ScoringRule;
}) {
  const scoringKey =
    scoring === 'volleyball'
      ? 'standings.scoringVolleyball'
      : 'standings.scoringFifa';
  return (
    <View>
      <Text className="text-[11px] text-slate-500 dark:text-slate-400">
        {t('standings.legend')}
      </Text>
      <Text className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        {t(scoringKey)}
      </Text>
      <Text className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        {t('standings.tiebreakers')}
      </Text>
    </View>
  );
}
