import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Trophy } from 'lucide-react-native';

import { ScoreEntryModal } from '@/components/ScoreEntryModal';
import { Screen } from '@/components/ui/Screen';
import { listParticipants } from '@/db/participants';
import { useTranslation } from '@/i18n/useTranslation';
import { useMatchesStore } from '@/stores/useMatchesStore';
import { useTournamentsStore } from '@/stores/useTournamentsStore';
import type { Match, Participant } from '@/types/tournament';

const EMPTY_MATCHES: readonly Match[] = Object.freeze([]);

export default function MatchesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const router = useRouter();
  const { t } = useTranslation();

  const matches = useMatchesStore(
    (s) => s.byTournament[tournamentId] ?? EMPTY_MATCHES
  ) as Match[];
  const load = useMatchesStore((s) => s.load);
  const setScore = useMatchesStore((s) => s.setScore);
  const clearScore = useMatchesStore((s) => s.clearScore);
  const tournament = useTournamentsStore((s) =>
    s.tournaments.find((tt) => tt.id === tournamentId)
  );
  const allowDraws =
    tournament != null && tournament.type !== 'single_elimination';
  const isRoundRobin = tournament?.type === 'round_robin';

  const [participantsById, setParticipantsById] = useState<
    Map<number, Participant>
  >(() => new Map());
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    let cancelled = false;
    load(tournamentId);
    listParticipants(tournamentId).then((list) => {
      if (cancelled) return;
      setParticipantsById(new Map(list.map((p) => [p.id, p])));
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, load]);

  const matchesByRound = useMemo(() => {
    const map = new Map<number, Match[]>();
    for (const m of matches) {
      const arr = map.get(m.round) ?? [];
      arr.push(m);
      map.set(m.round, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.id - b.id);
    }
    return map;
  }, [matches]);

  const totalRounds = matchesByRound.size;

  const editingMatch = useMemo(
    () => matches.find((m) => m.id === editingMatchId) ?? null,
    [matches, editingMatchId]
  );
  const editingA = editingMatch?.participantAId
    ? (participantsById.get(editingMatch.participantAId) ?? null)
    : null;
  const editingB = editingMatch?.participantBId
    ? (participantsById.get(editingMatch.participantBId) ?? null)
    : null;

  const handleSaveScore = useCallback(
    async (a: number, b: number) => {
      if (!editingMatch) return;
      await setScore(tournamentId, editingMatch.id, a, b);
    },
    [editingMatch, setScore, tournamentId]
  );

  const handleClearScore = useCallback(async () => {
    if (!editingMatch) return;
    await clearScore(tournamentId, editingMatch.id);
  }, [editingMatch, clearScore, tournamentId]);

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
          {t('matches.title')}
        </Text>
      </View>

      {matches.length === 0 ? (
        <View className="mt-16 items-center px-6">
          <View className="mb-4 rounded-full bg-slate-100 p-5 dark:bg-slate-800">
            <Trophy size={32} color="#94a3b8" />
          </View>
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {t('matches.noMatchesYet')}
          </Text>
          <Text className="mt-1 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('matches.noMatchesYetDescription')}
          </Text>
        </View>
      ) : isRoundRobin ? (
        <View className="mt-4 gap-2">
          {matches.map((m, idx) => (
            <MatchCard
              key={m.id}
              match={m}
              index={idx}
              participantsById={participantsById}
              onPress={() => setEditingMatchId(m.id)}
            />
          ))}
        </View>
      ) : (
        <View className="mt-4">
          {Array.from(matchesByRound.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([round, roundMatches]) => (
              <View key={round} className="mb-6">
                <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {roundLabel(round, totalRounds, t)}
                </Text>
                <View className="gap-2">
                  {roundMatches.map((m, idx) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      index={idx}
                      participantsById={participantsById}
                      onPress={() => setEditingMatchId(m.id)}
                    />
                  ))}
                </View>
              </View>
            ))}
        </View>
      )}

      <ScoreEntryModal
        visible={editingMatchId != null}
        match={editingMatch}
        participantA={editingA}
        participantB={editingB}
        allowDraws={allowDraws}
        onClose={() => setEditingMatchId(null)}
        onSave={handleSaveScore}
        onClear={handleClearScore}
      />
    </Screen>
  );
}

function roundLabel(
  round: number,
  totalRounds: number,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return t('matches.final');
  if (fromEnd === 1) return t('matches.semifinal');
  if (fromEnd === 2) return t('matches.quarterfinal');
  if (fromEnd === 3) return t('matches.round16');
  if (fromEnd === 4) return t('matches.round32');
  return t('matches.round', { n: round });
}

function MatchCard({
  match,
  index,
  participantsById,
  onPress,
}: {
  match: Match;
  index: number;
  participantsById: Map<number, Participant>;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const a = match.participantAId
    ? participantsById.get(match.participantAId)
    : null;
  const b = match.participantBId
    ? participantsById.get(match.participantBId)
    : null;

  const aIsBye = !a && match.participantBId !== null;
  const bIsBye = !b && match.participantAId !== null;
  const bothEmpty = !match.participantAId && !match.participantBId;
  const isPlayable = !!a && !!b;

  const aIsWinner = match.winnerId !== null && match.winnerId === a?.id;
  const bIsWinner = match.winnerId !== null && match.winnerId === b?.id;

  return (
    <Pressable
      onPress={isPlayable ? onPress : undefined}
      disabled={!isPlayable}
      className={`rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 ${
        isPlayable ? 'active:bg-slate-50 dark:active:bg-slate-800' : ''
      }`}
    >
      <Text className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        #{index + 1}
      </Text>
      <Side
        name={a?.name ?? (aIsBye ? t('matches.bye') : t('matches.tbd'))}
        score={match.scoreA}
        isWinner={aIsWinner}
        isPlaceholder={!a}
      />
      <View className="my-1.5 h-px bg-slate-100 dark:bg-slate-800" />
      <Side
        name={b?.name ?? (bIsBye ? t('matches.bye') : t('matches.tbd'))}
        score={match.scoreB}
        isWinner={bIsWinner}
        isPlaceholder={!b}
      />
      {bothEmpty ? (
        <Text className="mt-2 text-[11px] italic text-slate-400 dark:text-slate-500">
          {t('matches.tbd')}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Side({
  name,
  score,
  isWinner,
  isPlaceholder,
}: {
  name: string;
  score: number | null;
  isWinner: boolean;
  isPlaceholder: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text
        className={`flex-1 text-sm ${
          isWinner
            ? 'font-bold text-brand-700 dark:text-brand-200'
            : isPlaceholder
              ? 'italic text-slate-400 dark:text-slate-500'
              : 'text-slate-900 dark:text-slate-100'
        }`}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text
        className={`ml-2 min-w-[24px] text-right text-sm font-mono ${
          isWinner
            ? 'font-bold text-brand-700 dark:text-brand-200'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {score ?? '–'}
      </Text>
    </View>
  );
}
