import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Users } from 'lucide-react-native';

import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { listParticipants } from '@/db/participants';
import { listPhases } from '@/db/phases';
import { useThemeIcon } from '@/hooks/useThemeIcon';
import { useTranslation } from '@/i18n/useTranslation';
import { useMatchesStore } from '@/stores/useMatchesStore';
import type {
  Match,
  Participant,
  ScoringRule,
  TiebreakerPreset,
} from '@/types/tournament';
import { computeStandings, type StandingRow } from '@/utils/standings';

const EMPTY_MATCHES: readonly Match[] = Object.freeze([]);

export default function GroupsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const router = useRouter();
  const { t } = useTranslation();
  const icon = useThemeIcon();

  const matches = useMatchesStore(
    (s) => s.byTournament[tournamentId] ?? EMPTY_MATCHES
  ) as Match[];
  const matchesLoaded = useMatchesStore(
    (s) => s.byTournament[tournamentId] !== undefined
  );
  const load = useMatchesStore((s) => s.load);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoaded, setParticipantsLoaded] = useState(false);
  const [scoring, setScoring] = useState<ScoringRule>('fifa');
  const [tiebreaker, setTiebreaker] = useState<TiebreakerPreset>('fifa');

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    let cancelled = false;
    load(tournamentId);
    listParticipants(tournamentId).then((list) => {
      if (cancelled) return;
      setParticipants(list);
      setParticipantsLoaded(true);
    });
    listPhases(tournamentId).then((phases) => {
      if (cancelled) return;
      const groupPhase = phases.find((p) => p.ordinal === 0);
      if (groupPhase) {
        setScoring(groupPhase.scoring);
        setTiebreaker(groupPhase.tiebreaker);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, load]);

  const groupBuckets = useMemo(() => {
    const groupMatches = matches.filter((m) => m.stage === 'group');
    const labels = Array.from(
      new Set(
        groupMatches
          .map((m) => m.groupLabel)
          .filter((l): l is string => l != null)
      )
    ).sort();
    const byId = new Map(participants.map((p) => [p.id, p]));
    return labels.map((label) => {
      const ms = groupMatches.filter((m) => m.groupLabel === label);
      const ids = new Set<number>();
      for (const m of ms) {
        if (m.participantAId) ids.add(m.participantAId);
        if (m.participantBId) ids.add(m.participantBId);
      }
      const ps = [...ids]
        .map((i) => byId.get(i))
        .filter((p): p is Participant => p != null);
      return {
        label,
        matches: ms,
        standings: computeStandings(ms, ps, { scoring, tiebreaker }),
        participantsById: byId,
      };
    });
  }, [matches, participants, scoring, tiebreaker]);

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
          {t('groups.title')}
        </Text>
      </View>

      {!matchesLoaded || !participantsLoaded ? (
        <View className="mt-4">
          <SkeletonList rows={4} />
        </View>
      ) : groupBuckets.length === 0 ? (
        <View className="mt-16 items-center px-6">
          <View className="mb-4 rounded-full bg-slate-100 p-5 dark:bg-slate-800">
            <Users size={32} color="#94a3b8" />
          </View>
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {t('groups.empty')}
          </Text>
          <Text className="mt-1 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('groups.emptyDescription')}
          </Text>
        </View>
      ) : (
        <View className="mt-4 gap-6">
          {groupBuckets.map((bucket) => (
            <GroupCard
              key={bucket.label}
              label={bucket.label}
              standings={bucket.standings}
              matches={bucket.matches}
              participantsById={bucket.participantsById}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function GroupCard({
  label,
  standings,
  matches,
  participantsById,
}: {
  label: string;
  standings: StandingRow[];
  matches: Match[];
  participantsById: Map<number, Participant>;
}) {
  const { t } = useTranslation();
  return (
    <View className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <View className="bg-slate-100 px-4 py-2 dark:bg-slate-800">
        <Text className="text-sm font-bold text-slate-900 dark:text-white">
          {t('groups.groupTitle', { label })}
        </Text>
      </View>

      {/* Standings */}
      <View className="bg-white dark:bg-slate-900">
        <View className="flex-row items-center bg-slate-50 px-3 py-1.5 dark:bg-slate-900">
          <Text className="w-6 text-center text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">#</Text>
          <Text className="flex-1 text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">{t('standings.team')}</Text>
          <MiniStat label={t('standings.played')} />
          <MiniStat label={t('standings.wins')} />
          <MiniStat label={t('standings.draws')} />
          <MiniStat label={t('standings.losses')} />
          <MiniStat label={t('standings.points')} bold />
        </View>
        {standings.map((row, idx) => (
          <View
            key={row.participantId}
            className={`flex-row items-center border-t border-slate-100 px-3 py-2 dark:border-slate-800 ${
              idx < 2 ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''
            }`}
          >
            <Text className="w-6 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
              {idx + 1}
            </Text>
            <Text className="flex-1 text-sm text-slate-900 dark:text-slate-100" numberOfLines={1}>
              {row.name}
            </Text>
            <MiniCell value={row.played} />
            <MiniCell value={row.wins} />
            <MiniCell value={row.draws} />
            <MiniCell value={row.losses} />
            <MiniCell value={row.points} bold />
          </View>
        ))}
      </View>

      {/* Matches */}
      <View className="border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('matches.title')}
        </Text>
        {matches.map((m) => (
          <GroupMatchRow
            key={m.id}
            match={m}
            participantsById={participantsById}
          />
        ))}
      </View>
    </View>
  );
}

function GroupMatchRow({
  match,
  participantsById,
}: {
  match: Match;
  participantsById: Map<number, Participant>;
}) {
  const a = match.participantAId
    ? participantsById.get(match.participantAId)
    : null;
  const b = match.participantBId
    ? participantsById.get(match.participantBId)
    : null;
  const played = match.scoreA != null && match.scoreB != null;
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="flex-1 text-sm text-slate-700 dark:text-slate-300" numberOfLines={1}>
        {a?.name ?? '–'}
      </Text>
      <Text className="mx-3 text-sm font-mono text-slate-500 dark:text-slate-400">
        {played ? `${match.scoreA} – ${match.scoreB}` : 'vs'}
      </Text>
      <Text className="flex-1 text-right text-sm text-slate-700 dark:text-slate-300" numberOfLines={1}>
        {b?.name ?? '–'}
      </Text>
    </View>
  );
}

function MiniStat({ label, bold = false }: { label: string; bold?: boolean }) {
  return (
    <Text
      className={`w-7 text-center text-[10px] uppercase text-slate-500 dark:text-slate-400 ${
        bold ? 'font-bold text-slate-700 dark:text-slate-300' : 'font-semibold'
      }`}
    >
      {label}
    </Text>
  );
}

function MiniCell({
  value,
  bold = false,
}: {
  value: number | string;
  bold?: boolean;
}) {
  return (
    <Text
      className={`w-7 text-center text-sm font-mono ${
        bold
          ? 'font-bold text-slate-900 dark:text-white'
          : 'text-slate-700 dark:text-slate-300'
      }`}
    >
      {value}
    </Text>
  );
}
