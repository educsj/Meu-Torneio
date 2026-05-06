import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { ParticipantBadge } from '@/components/ParticipantBadge';
import { useTranslation } from '@/i18n/useTranslation';
import type { Match, Participant } from '@/types/tournament';

const MATCH_HEIGHT = 56;
const MATCH_WIDTH = 150;
const ROUND_GAP = 28;

interface Props {
  matches: Match[];
  participantsById: Map<number, Participant>;
}

/**
 * Classic single-elimination bracket renderer. Lays out rounds as
 * columns; matches stack vertically with `justifyContent: 'space-around'`
 * so each later-round match is mathematically centered between the two
 * matches that feed into it. SVG connectors draw the "U" between
 * feeder pairs.
 *
 * Works for any power-of-two-friendly bracket (with BYEs in round 1 if
 * the count isn't a power of two). Empty slots render as "A definir";
 * BYEs as "BYE".
 */
export function BracketTree({ matches, participantsById }: Props) {
  const { t } = useTranslation();

  const rounds = useMemo(() => {
    const map = new Map<number, Match[]>();
    for (const m of matches) {
      const arr = map.get(m.round) ?? [];
      arr.push(m);
      map.set(m.round, arr);
    }
    // Within a round, sort by id so connector targets align with the
    // generator's pairing order (siblings 2j and 2j+1 feed match j).
    for (const arr of map.values()) {
      arr.sort((a, b) => a.id - b.id);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, ms]) => ({ round, matches: ms }));
  }, [matches]);

  if (rounds.length === 0) {
    return null;
  }

  const round1Count = rounds[0].matches.length;
  // Total column height = round1Count slots × MATCH_HEIGHT + an equal-share
  // extra space that justifyContent: 'space-around' will distribute.
  // We give each round1 slot 1.4× match height so connectors have room.
  const SLOT_RATIO = 1.4;
  const totalHeight = Math.max(round1Count, 2) * MATCH_HEIGHT * SLOT_RATIO;

  return (
    <View className="flex-row" style={{ minHeight: totalHeight }}>
      {rounds.map((r, idx) => (
        <View key={r.round} className="flex-row">
          <BracketColumn
            matches={r.matches}
            totalHeight={totalHeight}
            participantsById={participantsById}
            tbdLabel={t('matches.tbd')}
            byeLabel={t('matches.bye')}
          />
          {idx < rounds.length - 1 ? (
            <BracketConnector
              prevCount={r.matches.length}
              totalHeight={totalHeight}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function BracketColumn({
  matches,
  totalHeight,
  participantsById,
  tbdLabel,
  byeLabel,
}: {
  matches: Match[];
  totalHeight: number;
  participantsById: Map<number, Participant>;
  tbdLabel: string;
  byeLabel: string;
}) {
  return (
    <View
      style={{
        width: MATCH_WIDTH,
        height: totalHeight,
        justifyContent: 'space-around',
      }}
    >
      {matches.map((m) => (
        <BracketMatchBox
          key={m.id}
          match={m}
          participantsById={participantsById}
          tbdLabel={tbdLabel}
          byeLabel={byeLabel}
        />
      ))}
    </View>
  );
}

function BracketMatchBox({
  match,
  participantsById,
  tbdLabel,
  byeLabel,
}: {
  match: Match;
  participantsById: Map<number, Participant>;
  tbdLabel: string;
  byeLabel: string;
}) {
  const a = match.participantAId
    ? participantsById.get(match.participantAId)
    : null;
  const b = match.participantBId
    ? participantsById.get(match.participantBId)
    : null;
  const aIsBye = !a && match.participantBId != null;
  const bIsBye = !b && match.participantAId != null;
  const aWon = match.winnerId != null && match.winnerId === a?.id;
  const bWon = match.winnerId != null && match.winnerId === b?.id;

  return (
    <View
      className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      style={{ height: MATCH_HEIGHT }}
    >
      <BracketSide
        participant={a}
        name={a?.name ?? (aIsBye ? byeLabel : tbdLabel)}
        score={match.scoreA}
        won={aWon}
        placeholder={!a}
      />
      <View className="h-px bg-slate-100 dark:bg-slate-800" />
      <BracketSide
        participant={b}
        name={b?.name ?? (bIsBye ? byeLabel : tbdLabel)}
        score={match.scoreB}
        won={bWon}
        placeholder={!b}
      />
      {match.walkover ? (
        <View className="absolute right-1 top-1 rounded bg-amber-500 px-1">
          <Text className="text-[8px] font-bold text-white">W.O.</Text>
        </View>
      ) : null}
    </View>
  );
}

function BracketSide({
  participant,
  name,
  score,
  won,
  placeholder,
}: {
  participant: Participant | null | undefined;
  name: string;
  score: number | null;
  won: boolean;
  placeholder: boolean;
}) {
  return (
    <View className="flex-1 flex-row items-center justify-between gap-1.5 px-2">
      {participant ? (
        <ParticipantBadge
          icon={participant.icon}
          iconColor={participant.iconColor}
          name={participant.name}
          size={18}
        />
      ) : null}
      <Text
        className={`flex-1 text-xs ${
          won
            ? 'font-bold text-brand-700 dark:text-brand-200'
            : placeholder
              ? 'italic text-slate-400'
              : 'text-slate-900 dark:text-slate-100'
        }`}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text
        className={`ml-1 text-xs font-mono ${
          won
            ? 'font-bold text-brand-700 dark:text-brand-200'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {score ?? '–'}
      </Text>
    </View>
  );
}

/**
 * Draws the connector lines between two adjacent rounds. With N feeder
 * matches in the previous round (centers at (i + 0.5) × T/N), each pair
 * (2j, 2j+1) feeds match j of the next round (center at (j + 0.5) × T/(N/2)).
 *
 * For each pair we draw a "U":
 *   ─ from feeder A's center, half the gap to the right
 *   │ vertical line connecting feeder A's center to feeder B's center
 *   ─ from feeder B's center, half the gap to the right
 *   ─ from the midpoint, the rest of the gap to the right (feeds next match)
 */
function BracketConnector({
  prevCount,
  totalHeight,
}: {
  prevCount: number;
  totalHeight: number;
}) {
  // If the previous round has odd count, we can't pair cleanly — render
  // empty space (still keeps spacing consistent).
  const pairs = Math.floor(prevCount / 2);
  const slotHeight = totalHeight / prevCount;
  const halfGap = ROUND_GAP / 2;
  const stroke = '#94a3b8'; // slate-400
  const strokeWidth = 1.2;

  return (
    <Svg width={ROUND_GAP} height={totalHeight}>
      {Array.from({ length: pairs }).flatMap((_, j) => {
        const yA = (2 * j + 0.5) * slotHeight;
        const yB = (2 * j + 1.5) * slotHeight;
        const yNext = (2 * j + 1) * slotHeight;
        const segments = [
          // Horizontal stub from feeder A
          <Line
            key={`a-${j}`}
            x1={0}
            y1={yA}
            x2={halfGap}
            y2={yA}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />,
          // Horizontal stub from feeder B
          <Line
            key={`b-${j}`}
            x1={0}
            y1={yB}
            x2={halfGap}
            y2={yB}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />,
          // Vertical at midpoint connecting A and B
          <Line
            key={`v-${j}`}
            x1={halfGap}
            y1={yA}
            x2={halfGap}
            y2={yB}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />,
          // Horizontal feeding the next-round match
          <Line
            key={`n-${j}`}
            x1={halfGap}
            y1={yNext}
            x2={ROUND_GAP}
            y2={yNext}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />,
        ];
        return segments;
      })}
    </Svg>
  );
}
