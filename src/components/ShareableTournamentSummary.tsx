import { forwardRef, useMemo } from 'react';
import { Text, View } from 'react-native';

import { BracketTree } from '@/components/BracketTree';
import { useTranslation } from '@/i18n/useTranslation';
import type {
  Match,
  Participant,
  Tournament,
  TournamentType,
} from '@/types/tournament';
import { computeStandings } from '@/utils/standings';

interface Props {
  tournament: Tournament;
  participants: Participant[];
  matches: Match[];
}

const TYPE_LABEL_KEY: Record<TournamentType, string> = {
  single_elimination: 'singleElimination',
  round_robin: 'roundRobin',
  groups_knockout: 'groupsKnockout',
  league_playoff: 'leaguePlayoff',
  custom: 'custom',
};

/**
 * Capture-friendly read-only summary of a tournament.
 *
 * Designed to be wrapped in a ViewShot ref and rendered as PNG. Does
 * NOT include navigation chrome, scroll controls, or interactive
 * affordances — just the data, with consistent spacing so the captured
 * image looks intentional.
 *
 * Forwards a ref to the outer container so callers can pass it to
 * captureRef from react-native-view-shot.
 */
export const ShareableTournamentSummary = forwardRef<View, Props>(
  function ShareableTournamentSummary(
    { tournament, participants, matches },
    ref
  ) {
    const { t } = useTranslation();

    const participantsById = useMemo(
      () => new Map(participants.map((p) => [p.id, p])),
      [participants]
    );

    // Standings reflect only league/group matches. For single-elim there's
    // no league phase to rank, so we skip the section.
    const showStandings =
      tournament.type !== 'single_elimination' &&
      matches.some(
        (m) => m.stage === 'group' || tournament.type === 'round_robin'
      );

    const standingsMatches = useMemo(
      () =>
        matches.filter(
          (m) => m.stage === 'group' || tournament.type === 'round_robin'
        ),
      [matches, tournament.type]
    );

    const standings = useMemo(
      () =>
        showStandings
          ? computeStandings(standingsMatches, participants)
          : [],
      [showStandings, standingsMatches, participants]
    );

    // Section grouping for the matches block:
    //   - For multi-stage tournaments we split league/group matches from
    //     knockout matches and label rounds appropriately.
    //   - For single-stage we just show one "Partidas" block.
    const groupMatches = useMemo(
      () => matches.filter((m) => m.stage === 'group'),
      [matches]
    );
    const knockoutMatches = useMemo(
      () =>
        matches
          .filter((m) => m.stage === 'knockout')
          .sort((a, b) => a.id - b.id),
      [matches]
    );
    const mainMatches = useMemo(
      () => matches.filter((m) => m.stage === 'main'),
      [matches]
    );

    const isPlacementPlayoff =
      knockoutMatches.length > 0 &&
      knockoutMatches.every((m) => m.nextMatchId == null);

    const exportedAt = new Date();

    return (
      <View
        ref={ref}
        collapsable={false}
        className="bg-white p-6 dark:bg-slate-950"
        // Width adapts to its container instead of being clamped at 600 — a
        // fixed-width-larger-than-the-screen made the preview unreadable on
        // phones, even though the captured PNG looked fine. captureRef
        // captures at the native pixel ratio, so on a 3x-DPR phone a
        // logical-360 layout still yields a >1000px-wide PNG.
      >
        <Header
          tournament={tournament}
          participants={participants.length}
          exportedAt={exportedAt}
          t={t}
        />

        {showStandings && standings.length > 0 ? (
          <Section title={t('image.standings')}>
            <StandingsTable standings={standings} t={t} />
          </Section>
        ) : null}

        {mainMatches.length > 0 ? (
          <Section title={t('image.matches')}>
            {tournament.type === 'single_elimination' ? (
              <BracketTree
                matches={mainMatches}
                participantsById={participantsById}
              />
            ) : (
              <MatchesByRound
                matches={mainMatches}
                participantsById={participantsById}
                roundLabelFor={(round, total) =>
                  singleElimRoundLabel(round, total, t)
                }
                t={t}
              />
            )}
          </Section>
        ) : null}

        {groupMatches.length > 0 ? (
          <Section
            title={
              tournament.type === 'league_playoff'
                ? t('matches.leaguePhase')
                : t('matches.groupStage')
            }
          >
            <MatchesByRound
              matches={groupMatches}
              participantsById={participantsById}
              roundLabelFor={(round) => t('matches.round', { n: round })}
              t={t}
            />
          </Section>
        ) : null}

        {knockoutMatches.length > 0 ? (
          <Section title={t('image.knockout')}>
            {isPlacementPlayoff ? (
              <PlacementMatches
                matches={knockoutMatches}
                participantsById={participantsById}
                t={t}
              />
            ) : (
              <BracketTree
                matches={knockoutMatches}
                participantsById={participantsById}
              />
            )}
          </Section>
        ) : null}

        {matches.length === 0 ? (
          <View className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 dark:border-slate-700">
            <Text className="text-center text-sm text-slate-500 dark:text-slate-400">
              {t('image.noMatchesYet')}
            </Text>
          </View>
        ) : null}

        <Text className="mt-8 text-center text-[10px] text-slate-400 dark:text-slate-500">
          {t('image.footer', { date: formatDate(exportedAt) })}
        </Text>
      </View>
    );
  }
);

function Header({
  tournament,
  participants,
  exportedAt,
  t,
}: {
  tournament: Tournament;
  participants: number;
  exportedAt: Date;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <View className="border-b border-slate-200 pb-4 dark:border-slate-800">
      <Text
        className="text-2xl font-bold text-slate-900 dark:text-white"
        numberOfLines={2}
      >
        {tournament.name}
      </Text>
      <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <MetaPill
          label={t(`newTournament.types.${TYPE_LABEL_KEY[tournament.type]}`)}
          tone="brand"
        />
        <MetaPill
          label={t(`tournament.status.${tournament.status}`)}
          tone="neutral"
        />
        <Text className="text-xs text-slate-500 dark:text-slate-400">
          {t('image.participantsCount', { count: participants })}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400">
          {formatDate(exportedAt)}
        </Text>
      </View>
    </View>
  );
}

function MetaPill({
  label,
  tone,
}: {
  label: string;
  tone: 'brand' | 'neutral';
}) {
  const styles =
    tone === 'brand'
      ? {
          container: 'bg-brand-50 dark:bg-brand-950',
          text: 'text-brand-700 dark:text-brand-200',
        }
      : {
          container: 'bg-slate-100 dark:bg-slate-800',
          text: 'text-slate-700 dark:text-slate-300',
        };
  return (
    <View className={`rounded-full px-2.5 py-1 ${styles.container}`}>
      <Text className={`text-xs font-semibold ${styles.text}`}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-5">
      <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </Text>
      {children}
    </View>
  );
}

function StandingsTable({
  standings,
  t,
}: {
  standings: ReturnType<typeof computeStandings>;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <View className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <View className="flex-row items-center bg-slate-50 px-3 py-2 dark:bg-slate-900">
        <Text className="w-6 text-center text-[10px] font-semibold uppercase text-slate-500">
          #
        </Text>
        <Text className="flex-1 text-[10px] font-semibold uppercase text-slate-500">
          {t('standings.team')}
        </Text>
        <SmallStat label={t('standings.played')} />
        <SmallStat label={t('standings.wins')} />
        <SmallStat label={t('standings.draws')} />
        <SmallStat label={t('standings.losses')} />
        <SmallStat label={t('standings.points')} bold />
      </View>
      {standings.map((row, idx) => (
        <View
          key={row.participantId}
          className={`flex-row items-center border-t border-slate-100 px-3 py-2 dark:border-slate-800 ${
            idx === 0 ? 'bg-brand-50/50 dark:bg-brand-950/30' : ''
          }`}
        >
          <Text className="w-6 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
            {idx + 1}
          </Text>
          <Text
            className="flex-1 text-sm text-slate-900 dark:text-slate-100"
            numberOfLines={1}
          >
            {row.name}
          </Text>
          <SmallCell value={row.played} />
          <SmallCell value={row.wins} />
          <SmallCell value={row.draws} />
          <SmallCell value={row.losses} />
          <SmallCell value={row.points} bold />
        </View>
      ))}
    </View>
  );
}

function SmallStat({ label, bold = false }: { label: string; bold?: boolean }) {
  return (
    <Text
      className={`w-8 text-center text-[10px] uppercase text-slate-500 ${
        bold ? 'font-bold text-slate-700' : 'font-semibold'
      }`}
    >
      {label}
    </Text>
  );
}

function SmallCell({
  value,
  bold = false,
}: {
  value: number | string;
  bold?: boolean;
}) {
  return (
    <Text
      className={`w-8 text-center text-sm font-mono ${
        bold ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
      }`}
    >
      {value}
    </Text>
  );
}

function MatchesByRound({
  matches,
  participantsById,
  roundLabelFor,
  t,
}: {
  matches: Match[];
  participantsById: Map<number, Participant>;
  roundLabelFor: (round: number, totalRounds: number) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const totalRounds =
    matches.length > 0 ? Math.max(...matches.map((m) => m.round)) : 0;
  const grouped = new Map<number, Match[]>();
  for (const m of matches) {
    const arr = grouped.get(m.round) ?? [];
    arr.push(m);
    grouped.set(m.round, arr);
  }
  return (
    <View className="gap-3">
      {Array.from(grouped.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([round, ms]) => (
          <View key={round}>
            <Text className="mb-1.5 text-[11px] font-medium uppercase text-slate-400 dark:text-slate-500">
              {roundLabelFor(round, totalRounds)}
            </Text>
            <View className="gap-1.5">
              {ms.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  participantsById={participantsById}
                  t={t}
                />
              ))}
            </View>
          </View>
        ))}
    </View>
  );
}

function PlacementMatches({
  matches,
  participantsById,
  t,
}: {
  matches: Match[];
  participantsById: Map<number, Participant>;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <View className="gap-3">
      {matches.map((m, idx) => (
        <View key={m.id}>
          <Text className="mb-1.5 text-[11px] font-medium uppercase text-slate-400 dark:text-slate-500">
            {idx === 0 ? t('matches.final') : t('matches.thirdPlace')}
          </Text>
          <MatchRow
            match={m}
            participantsById={participantsById}
            t={t}
          />
        </View>
      ))}
    </View>
  );
}

function MatchRow({
  match,
  participantsById,
  t,
}: {
  match: Match;
  participantsById: Map<number, Participant>;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const a = match.participantAId
    ? participantsById.get(match.participantAId)
    : null;
  const b = match.participantBId
    ? participantsById.get(match.participantBId)
    : null;
  const played = match.scoreA != null && match.scoreB != null;
  const aWon = match.winnerId != null && match.winnerId === a?.id;
  const bWon = match.winnerId != null && match.winnerId === b?.id;
  const aIsBye = !a && match.participantBId != null;
  const bIsBye = !b && match.participantAId != null;
  const groupBadge = match.groupLabel
    ? `${t('groups.groupTitle', { label: match.groupLabel })} · `
    : '';

  return (
    <View className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <View className="flex-row items-center justify-between">
        <Text
          className={`flex-1 text-sm ${
            aWon
              ? 'font-bold text-brand-700 dark:text-brand-200'
              : !a
                ? 'italic text-slate-400'
                : 'text-slate-900 dark:text-slate-100'
          }`}
          numberOfLines={1}
        >
          {a?.name ?? (aIsBye ? t('matches.bye') : t('matches.tbd'))}
        </Text>
        <Text
          className={`mx-3 text-sm font-mono ${
            played ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'
          }`}
        >
          {played ? `${match.scoreA} – ${match.scoreB}` : 'vs'}
        </Text>
        <Text
          className={`flex-1 text-right text-sm ${
            bWon
              ? 'font-bold text-brand-700 dark:text-brand-200'
              : !b
                ? 'italic text-slate-400'
                : 'text-slate-900 dark:text-slate-100'
          }`}
          numberOfLines={1}
        >
          {b?.name ?? (bIsBye ? t('matches.bye') : t('matches.tbd'))}
        </Text>
      </View>
      {groupBadge ? (
        <Text className="mt-1 text-[10px] uppercase text-slate-400">
          {groupBadge.replace(/ · $/, '')}
        </Text>
      ) : null}
    </View>
  );
}

function singleElimRoundLabel(
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

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
