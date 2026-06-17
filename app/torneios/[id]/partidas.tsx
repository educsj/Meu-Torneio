import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, ChevronLeft, MapPin, Trophy } from 'lucide-react-native';

import { ParticipantBadge } from '@/components/ParticipantBadge';
import { ScoreEntryModal } from '@/components/ScoreEntryModal';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { listParticipants } from '@/db/participants';
import {
  deleteScorersForMatch,
  listScorersForMatch,
  setScorersForMatch,
} from '@/db/scorers';
import { useThemeIcon } from '@/hooks/useThemeIcon';
import { useTranslation } from '@/i18n/useTranslation';
import {
  GRAND_FINAL_LABEL,
  LOSERS_BRACKET_LABEL,
  THIRD_PLACE_LABEL,
  WINNERS_BRACKET_LABEL,
} from '@/utils/bracket';
import { useMatchesStore } from '@/stores/useMatchesStore';
import { useTournamentsStore } from '@/stores/useTournamentsStore';
import type {
  Match,
  Participant,
  Scorer,
  ScorerInput,
} from '@/types/tournament';

const EMPTY_MATCHES: readonly Match[] = Object.freeze([]);

export default function MatchesScreen() {
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
  const setScore = useMatchesStore((s) => s.setScore);
  const clearScore = useMatchesStore((s) => s.clearScore);
  const saveSchedule = useMatchesStore((s) => s.saveSchedule);
  const tournament = useTournamentsStore((s) =>
    s.tournaments.find((tt) => tt.id === tournamentId)
  );
  const isSingleElim = tournament?.type === 'single_elimination';
  const isDoubleElim = tournament?.type === 'double_elimination';
  const isRoundRobin = tournament?.type === 'round_robin';
  const isGroupsKnockout = tournament?.type === 'groups_knockout';
  const isLeaguePlayoff = tournament?.type === 'league_playoff';
  const isCustom = tournament?.type === 'custom';
  // Draws allowed for league/group matches; disallowed for any single-shot
  // knockout match (single elim, groups+ko final, or placement playoff).
  // For custom tournaments we use the per-match stage as the gate.
  const allowDrawsFor = (m: Match | null) => {
    if (!tournament) return false;
    if (tournament.type === 'single_elimination') return false;
    if (tournament.type === 'groups_knockout') return m?.stage === 'group';
    if (tournament.type === 'league_playoff') return m?.stage === 'group';
    if (tournament.type === 'custom') return m?.stage !== 'knockout';
    return true;
  };

  const [participantsById, setParticipantsById] = useState<
    Map<number, Participant>
  >(() => new Map());
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);
  const [editingScorers, setEditingScorers] = useState<Scorer[]>([]);

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

  const groupStageMatches = useMemo(
    () => matches.filter((m) => m.stage === 'group'),
    [matches]
  );
  const playoffMatches = useMemo(
    () =>
      matches
        .filter((m) => m.stage === 'knockout')
        .sort((a, b) => a.id - b.id),
    [matches]
  );

  // For custom tournaments, derive the multi-phase shape from the matches
  // themselves rather than the (single) tournament.type label.
  const isCustomMultiPhase =
    isCustom && groupStageMatches.length > 0 && playoffMatches.length > 0;
  // Placement vs. bracketed knockout: placement playoffs have no nextMatchId
  // (they're parallel single-shot matches). Used to choose the right render.
  const playoffIsPlacement =
    playoffMatches.length > 0 &&
    playoffMatches.every((m) => m.nextMatchId == null);
  const renderAsLeaguePlayoff =
    isLeaguePlayoff || (isCustomMultiPhase && playoffIsPlacement);
  const renderAsGroupsKnockout =
    isGroupsKnockout || (isCustomMultiPhase && !playoffIsPlacement);

  const matchesByRound = useMemo(() => {
    const map = new Map<number, Match[]>();
    // For SE, group all matches by round. For two-phase formats, group only
    // the knockout stage by round (group matches have their own section).
    const source = renderAsGroupsKnockout || renderAsLeaguePlayoff
      ? matches.filter((m) => m.stage === 'knockout')
      : matches;
    for (const m of source) {
      // The 3rd-place match shares the final round but renders separately
      // under its own label — exclude it from the per-round grouping here.
      if (m.groupLabel === THIRD_PLACE_LABEL) continue;
      const arr = map.get(m.round) ?? [];
      arr.push(m);
      map.set(m.round, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.id - b.id);
    }
    return map;
  }, [matches, renderAsGroupsKnockout, renderAsLeaguePlayoff]);

  const totalRounds = matchesByRound.size;

  const thirdPlaceMatch = useMemo(
    () => matches.find((m) => m.groupLabel === THIRD_PLACE_LABEL) ?? null,
    [matches]
  );

  // Double elimination: split matches by their bracket section so the UI
  // can render WB / LB / GF as labelled blocks instead of one big "rounds".
  const wbMatches = useMemo(
    () =>
      matches
        .filter((m) => m.groupLabel === WINNERS_BRACKET_LABEL)
        .sort((a, b) => a.round - b.round || a.id - b.id),
    [matches]
  );
  const lbMatches = useMemo(
    () =>
      matches
        .filter((m) => m.groupLabel === LOSERS_BRACKET_LABEL)
        .sort((a, b) => a.round - b.round || a.id - b.id),
    [matches]
  );
  const grandFinalMatches = useMemo(
    () =>
      matches
        .filter((m) => m.groupLabel === GRAND_FINAL_LABEL)
        .sort((a, b) => a.round - b.round),
    [matches]
  );
  const grandFinalMatch = grandFinalMatches[0] ?? null;
  const bracketResetMatch = grandFinalMatches[1] ?? null;
  // GF2 (the bracket reset) is only visible once GF1 has a winner AND that
  // winner is the LB Champion (slot B). When the WB Champion (slot A) wins
  // GF1 there's no rematch — they'd need to lose 2x and they haven't.
  const showBracketReset =
    bracketResetMatch != null &&
    grandFinalMatch != null &&
    grandFinalMatch.winnerId != null &&
    grandFinalMatch.winnerId === grandFinalMatch.participantBId;

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
    async (a: number, b: number, options?: { walkover?: boolean }) => {
      if (!editingMatch) return;
      // Re-seed safety: editing a group/league score re-runs the seed
      // function and silently zeroes any playoff matches that were already
      // played. The check is type-agnostic — works for groups_knockout,
      // league_playoff, AND custom multi-phase configurations.
      const editingGroupOrLeague = editingMatch.stage === 'group';
      if (editingGroupOrLeague) {
        const playedPlayoffCount = matches.filter(
          (m) =>
            m.stage === 'knockout' && m.scoreA != null && m.scoreB != null
        ).length;
        if (playedPlayoffCount > 0) {
          const confirmed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              t('matches.reseedWarningTitle'),
              t('matches.reseedWarningMessage', {
                count: playedPlayoffCount,
              }),
              [
                {
                  text: t('common.cancel'),
                  style: 'cancel',
                  onPress: () => resolve(false),
                },
                {
                  text: t('common.confirm'),
                  style: 'destructive',
                  onPress: () => resolve(true),
                },
              ],
              { onDismiss: () => resolve(false) }
            );
          });
          if (!confirmed) return;
        }
      }
      await setScore(tournamentId, editingMatch.id, a, b, options);
    },
    [editingMatch, matches, setScore, tournamentId, t]
  );

  const handleClearScore = useCallback(async () => {
    if (!editingMatch) return;
    await clearScore(tournamentId, editingMatch.id);
    // Clearing the result drops its scorers too — they no longer correspond
    // to anything.
    await deleteScorersForMatch(editingMatch.id);
    setEditingScorers([]);
  }, [editingMatch, clearScore, tournamentId]);

  const handleSaveSchedule = useCallback(
    async (scheduledAt: string | null, location: string | null) => {
      if (!editingMatch) return;
      await saveSchedule(tournamentId, editingMatch.id, scheduledAt, location);
    },
    [editingMatch, saveSchedule, tournamentId]
  );

  const handleSaveScorers = useCallback(
    async (rows: ScorerInput[]) => {
      if (!editingMatch) return;
      await setScorersForMatch(editingMatch.id, rows);
      setEditingScorers(await listScorersForMatch(editingMatch.id));
    },
    [editingMatch]
  );

  // Load the open match's scorers so the modal can show/edit them.
  useEffect(() => {
    if (editingMatchId == null) {
      setEditingScorers([]);
      return;
    }
    let cancelled = false;
    listScorersForMatch(editingMatchId).then((list) => {
      if (!cancelled) setEditingScorers(list);
    });
    return () => {
      cancelled = true;
    };
  }, [editingMatchId]);

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
          {t('matches.title')}
        </Text>
      </View>

      {!matchesLoaded ? (
        <View className="mt-4">
          <SkeletonList rows={5} />
        </View>
      ) : matches.length === 0 ? (
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
      ) : isDoubleElim ? (
        <View className="mt-4">
          {/* Winners bracket */}
          {wbMatches.length > 0 ? (
            <View className="mb-6">
              <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('matches.winnersBracket')}
              </Text>
              {groupByRound(wbMatches).map(([round, roundMatches]) => (
                <View key={round} className="mb-4">
                  <Text className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {roundLabel(
                      round,
                      Math.max(...wbMatches.map((m) => m.round)),
                      t
                    )}
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
          ) : null}

          {/* Losers bracket */}
          {lbMatches.length > 0 ? (
            <View className="mb-6">
              <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('matches.losersBracket')}
              </Text>
              {groupByRound(lbMatches).map(([round, roundMatches]) => (
                <View key={round} className="mb-4">
                  <Text className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {t('matches.round', { n: round })}
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
          ) : null}

          {/* Grand final */}
          {grandFinalMatch ? (
            <View className="mb-6">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('matches.grandFinal')}
              </Text>
              <MatchCard
                match={grandFinalMatch}
                index={0}
                participantsById={participantsById}
                onPress={() => setEditingMatchId(grandFinalMatch.id)}
              />
            </View>
          ) : null}

          {showBracketReset && bracketResetMatch ? (
            <View className="mb-6">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('matches.bracketReset')}
              </Text>
              <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                {t('matches.bracketResetHint')}
              </Text>
              <MatchCard
                match={bracketResetMatch}
                index={0}
                participantsById={participantsById}
                onPress={() => setEditingMatchId(bracketResetMatch.id)}
              />
            </View>
          ) : null}
        </View>
      ) : isRoundRobin ? (
        <View className="mt-4">
          {groupByRound(matches).map(([round, roundMatches]) => (
            <View key={round} className="mb-6">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('matches.round', { n: round })}
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
      ) : renderAsLeaguePlayoff ? (
        <View className="mt-4">
          {/* League phase (single-group double round-robin) */}
          {groupStageMatches.length > 0 ? (
            <View className="mb-6">
              <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('matches.leaguePhase')}
              </Text>
              {groupByRound(groupStageMatches).map(
                ([round, roundMatches]) => (
                  <View key={round} className="mb-4">
                    <Text className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {t('matches.round', { n: round })}
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
                )
              )}
            </View>
          ) : null}

          {/* Placement matches: each labelled individually (final, 3rd place). */}
          {playoffMatches.map((m, idx) => (
            <View key={m.id} className="mb-6">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {idx === 0 ? t('matches.final') : t('matches.thirdPlace')}
              </Text>
              <MatchCard
                match={m}
                index={idx}
                participantsById={participantsById}
                onPress={() => setEditingMatchId(m.id)}
              />
            </View>
          ))}
        </View>
      ) : (
        <View className="mt-4">
          {/* Group stage section (groups+knockout AND custom-multi-phase) */}
          {renderAsGroupsKnockout && groupStageMatches.length > 0 ? (
            <View className="mb-6">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('matches.groupStage')}
              </Text>
              <View className="gap-2">
                {groupStageMatches.map((m, idx) => (
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
          ) : null}

          {/* Bracket / knockout rounds */}
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

          {thirdPlaceMatch ? (
            <View className="mb-6">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('matches.thirdPlace')}
              </Text>
              <MatchCard
                match={thirdPlaceMatch}
                index={0}
                participantsById={participantsById}
                onPress={() => setEditingMatchId(thirdPlaceMatch.id)}
              />
            </View>
          ) : null}
        </View>
      )}

      <ScoreEntryModal
        visible={editingMatchId != null}
        match={editingMatch}
        participantA={editingA}
        participantB={editingB}
        allowDraws={allowDrawsFor(editingMatch)}
        scorers={editingScorers}
        onClose={() => setEditingMatchId(null)}
        onSave={handleSaveScore}
        onClear={handleClearScore}
        onSaveSchedule={handleSaveSchedule}
        onSaveScorers={handleSaveScorers}
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
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          #{index + 1}
        </Text>
        {match.walkover ? (
          <View className="rounded-full bg-amber-100 px-1.5 py-0.5 dark:bg-amber-900">
            <Text className="text-[9px] font-bold uppercase text-amber-800 dark:text-amber-200">
              {t('matches.walkoverBadge')}
            </Text>
          </View>
        ) : null}
      </View>
      <Side
        participant={a}
        name={a?.name ?? (aIsBye ? t('matches.bye') : t('matches.tbd'))}
        score={match.scoreA}
        isWinner={aIsWinner}
        isPlaceholder={!a}
      />
      <View className="my-1.5 h-px bg-slate-100 dark:bg-slate-800" />
      <Side
        participant={b}
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
      {match.scheduledAt || match.location ? (
        <ScheduleChip
          scheduledAt={match.scheduledAt}
          location={match.location}
        />
      ) : null}
    </Pressable>
  );
}

function ScheduleChip({
  scheduledAt,
  location,
}: {
  scheduledAt: string | null;
  location: string | null;
}) {
  return (
    <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 dark:border-slate-800">
      {scheduledAt ? (
        <View className="flex-row items-center gap-1">
          <Calendar size={11} color="#94a3b8" />
          <Text className="text-[11px] text-slate-600 dark:text-slate-400">
            {formatScheduledForDisplay(scheduledAt)}
          </Text>
        </View>
      ) : null}
      {location ? (
        <View className="flex-row items-center gap-1">
          <MapPin size={11} color="#94a3b8" />
          <Text
            className="text-[11px] text-slate-600 dark:text-slate-400"
            numberOfLines={1}
          >
            {location}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Group matches by their `round` field, sorted ascending. Within each
 * round, matches keep their listMatches() order (which is stage, round, id).
 * Returns an array of [round, matches] pairs ready to map over. */
function groupByRound(matches: Match[]): Array<[number, Match[]]> {
  const map = new Map<number, Match[]>();
  for (const m of matches) {
    const arr = map.get(m.round) ?? [];
    arr.push(m);
    map.set(m.round, arr);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

/** Render an ISO/local timestamp as "DD/MM/AAAA às HH:MM" (or just the date
 * if no time is present). Returns the raw string on parse failure so we
 * never render a broken date. */
function formatScheduledForDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d, h, mi] = m;
  const datePart = `${d}/${mo}/${y}`;
  return h && mi ? `${datePart} às ${h}:${mi}` : datePart;
}

function Side({
  participant,
  name,
  score,
  isWinner,
  isPlaceholder,
}: {
  participant: Participant | null | undefined;
  name: string;
  score: number | null;
  isWinner: boolean;
  isPlaceholder: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      {participant ? (
        <ParticipantBadge
          icon={participant.icon}
          iconColor={participant.iconColor}
          name={participant.name}
          size={24}
        />
      ) : null}
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
