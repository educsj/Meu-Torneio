import { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { Trophy } from 'lucide-react-native';
import Svg, {
  Defs,
  LinearGradient,
  Line,
  Rect,
  Stop,
} from 'react-native-svg';

import { useTranslation } from '@/i18n/useTranslation';
import type { Match, Participant } from '@/types/tournament';

const SLOT_HEIGHT = 50;
const SLOT_WIDTH = 150;
const COL_GAP = 40;
const CENTER_WIDTH = 220;
const CONNECTOR_COLOR = '#facc15'; // yellow-400 — matches the reference's lines
const TROPHY_COLOR = '#fbbf24';

interface Props {
  matches: Match[];
  participantsById: Map<number, Participant>;
  /** Tournament name shown above the bracket — provided by the caller so
   *  this component stays a pure layout. */
  title: string;
}

/**
 * Champions-League–style symmetric bracket. Two halves of the field
 * converge on a centered trophy + final card, with yellow connector lines
 * and a dark gradient background. Designed for capture as a shareable PNG.
 *
 * Supported sizes: 4-team (semis + final), 8-team (QF + semis + final),
 * 16-team (R16 + QF + semis + final). Larger / odd shapes fall through
 * to the simple summary.
 */
export const ChampionsBracket = forwardRef<View, Props>(
  function ChampionsBracket({ matches, participantsById, title }, ref) {
  const { t } = useTranslation();

  // Group matches by round, sort within round by id (the bracket inserter
  // keeps adjacent feeder matches adjacent in id order).
  const byRound = new Map<number, Match[]>();
  for (const m of matches) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  }
  for (const arr of byRound.values()) arr.sort((a, b) => a.id - b.id);

  const rounds = Array.from(byRound.entries()).sort((a, b) => a[0] - b[0]);
  if (rounds.length === 0) {
    return null;
  }

  const finalRound = rounds[rounds.length - 1];
  const finalMatch = finalRound[1][0];

  // Build the per-side rounds (everything but the final). Each round splits
  // its matches in half: first half → left, second half → right.
  const sideRounds = rounds.slice(0, -1).map(([round, ms]) => {
    const half = ms.length / 2;
    return {
      round,
      left: ms.slice(0, half),
      right: ms.slice(half),
    };
  });

  // The leftmost round (smallest round number = round 1) determines the
  // bracket's vertical extent — that's where every team is listed.
  const r1Count = sideRounds.length > 0 ? sideRounds[0].left.length : 1;
  const totalHeight = Math.max(r1Count, 2) * SLOT_HEIGHT * 1.45;

  return (
    <View ref={ref} collapsable={false} style={{ backgroundColor: '#0b1424' }}>
      <BackgroundGradient height={totalHeight + 220} />

      <View style={{ paddingTop: 28, paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text
          style={{
            color: '#facc15',
            fontSize: 14,
            fontWeight: '600',
            letterSpacing: 2,
            textAlign: 'center',
            opacity: 0.85,
          }}
        >
          {t('image.championsHeader').toUpperCase()}
        </Text>
        <Text
          style={{
            color: '#ffffff',
            fontSize: 26,
            fontWeight: '800',
            textAlign: 'center',
            marginTop: 4,
            letterSpacing: 1,
          }}
          numberOfLines={2}
        >
          {title.toUpperCase()}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 8,
          paddingBottom: 32,
        }}
      >
        {/* Left side — outermost round on the far left, advancing inward */}
        {sideRounds.map((r, idx) => (
          <View key={`L-${r.round}`} style={{ flexDirection: 'row' }}>
            <SideColumn
              matches={r.left}
              totalHeight={totalHeight}
              participantsById={participantsById}
              tbdLabel={t('matches.tbd')}
              byeLabel={t('matches.bye')}
            />
            <Connector
              prevCount={r.left.length}
              totalHeight={totalHeight}
              direction="right"
              isLast={idx === sideRounds.length - 1}
            />
          </View>
        ))}

        {/* Center: trophy + final */}
        <CenterFinal
          match={finalMatch}
          participantsById={participantsById}
          tbdLabel={t('matches.tbd')}
          finalLabel={t('matches.final')}
        />

        {/* Right side — mirrored: advances inward from the far right */}
        {[...sideRounds].reverse().map((r, idx) => (
          <View key={`R-${r.round}`} style={{ flexDirection: 'row' }}>
            <Connector
              prevCount={r.right.length}
              totalHeight={totalHeight}
              direction="left"
              isLast={idx === 0}
            />
            <SideColumn
              matches={r.right}
              totalHeight={totalHeight}
              participantsById={participantsById}
              tbdLabel={t('matches.tbd')}
              byeLabel={t('matches.bye')}
            />
          </View>
        ))}
      </View>

      <Text
        style={{
          color: '#94a3b8',
          fontSize: 11,
          textAlign: 'center',
          paddingBottom: 16,
          letterSpacing: 1,
        }}
      >
        {t('image.footer', {
          date: new Date().toLocaleDateString(),
        })}
      </Text>
    </View>
  );
});

function SideColumn({
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
        width: SLOT_WIDTH,
        height: totalHeight,
        justifyContent: 'space-around',
      }}
    >
      {matches.map((m) => (
        <MatchSlot
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

function MatchSlot({
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
      style={{
        height: SLOT_HEIGHT,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
        overflow: 'hidden',
      }}
    >
      <SlotSide
        name={a?.name ?? (aIsBye ? byeLabel : tbdLabel)}
        score={match.scoreA}
        won={aWon}
        placeholder={!a}
      />
      <View style={{ height: 1, backgroundColor: '#0b1424' }} />
      <SlotSide
        name={b?.name ?? (bIsBye ? byeLabel : tbdLabel)}
        score={match.scoreB}
        won={bWon}
        placeholder={!b}
      />
    </View>
  );
}

function SlotSide({
  name,
  score,
  won,
  placeholder,
}: {
  name: string;
  score: number | null;
  won: boolean;
  placeholder: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        backgroundColor: won ? 'rgba(250, 204, 21, 0.15)' : 'transparent',
      }}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 12,
          color: won
            ? '#fde68a'
            : placeholder
              ? '#64748b'
              : '#e2e8f0',
          fontWeight: won ? '700' : '500',
          fontStyle: placeholder ? 'italic' : 'normal',
        }}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text
        style={{
          marginLeft: 6,
          fontSize: 12,
          color: won ? '#fde68a' : '#94a3b8',
          fontWeight: won ? '700' : '500',
          fontVariant: ['tabular-nums'],
        }}
      >
        {score ?? '–'}
      </Text>
    </View>
  );
}

function CenterFinal({
  match,
  participantsById,
  tbdLabel,
  finalLabel,
}: {
  match: Match;
  participantsById: Map<number, Participant>;
  tbdLabel: string;
  finalLabel: string;
}) {
  const a = match.participantAId
    ? participantsById.get(match.participantAId)
    : null;
  const b = match.participantBId
    ? participantsById.get(match.participantBId)
    : null;
  const aWon = match.winnerId != null && match.winnerId === a?.id;
  const bWon = match.winnerId != null && match.winnerId === b?.id;

  return (
    <View
      style={{
        width: CENTER_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
      }}
    >
      <Trophy size={108} color={TROPHY_COLOR} fill={TROPHY_COLOR} strokeWidth={1.5} />
      <Text
        style={{
          color: '#facc15',
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: 2,
          marginTop: 8,
        }}
      >
        {finalLabel.toUpperCase()}
      </Text>
      <View
        style={{
          marginTop: 12,
          width: CENTER_WIDTH - 24,
          backgroundColor: '#1e293b',
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: '#facc15',
          overflow: 'hidden',
        }}
      >
        <SlotSide
          name={a?.name ?? tbdLabel}
          score={match.scoreA}
          won={aWon}
          placeholder={!a}
        />
        <View style={{ height: 1, backgroundColor: '#0b1424' }} />
        <SlotSide
          name={b?.name ?? tbdLabel}
          score={match.scoreB}
          won={bWon}
          placeholder={!b}
        />
      </View>
    </View>
  );
}

/**
 * Connector lines between two adjacent rounds. `direction='right'` means
 * the line exits to the right (left side of the bracket); `direction='left'`
 * mirrors for the right half. `isLast` removes the final outward stub so
 * the line meets the final card cleanly.
 */
function Connector({
  prevCount,
  totalHeight,
  direction,
  isLast,
}: {
  prevCount: number;
  totalHeight: number;
  direction: 'left' | 'right';
  isLast: boolean;
}) {
  const pairs = Math.floor(prevCount / 2);
  const slotHeight = totalHeight / prevCount;
  const halfGap = COL_GAP / 2;
  const stroke = CONNECTOR_COLOR;
  const strokeWidth = 1.5;
  const isRight = direction === 'right';

  return (
    <Svg width={COL_GAP} height={totalHeight}>
      {Array.from({ length: pairs }).flatMap((_, j) => {
        const yA = (2 * j + 0.5) * slotHeight;
        const yB = (2 * j + 1.5) * slotHeight;
        const yNext = (2 * j + 1) * slotHeight;
        // For the right side, mirror the X coordinates (start from COL_GAP).
        const x0 = isRight ? 0 : COL_GAP;
        const xMid = isRight ? halfGap : halfGap;
        const xOut = isRight ? COL_GAP : 0;
        return [
          <Line
            key={`a-${j}`}
            x1={x0}
            y1={yA}
            x2={xMid}
            y2={yA}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />,
          <Line
            key={`b-${j}`}
            x1={x0}
            y1={yB}
            x2={xMid}
            y2={yB}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />,
          <Line
            key={`v-${j}`}
            x1={xMid}
            y1={yA}
            x2={xMid}
            y2={yB}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />,
          // Outward stub feeding the next column. On the last connector
          // (closest to center) we skip it so the final card isn't crossed.
          isLast ? null : (
            <Line
              key={`n-${j}`}
              x1={xMid}
              y1={yNext}
              x2={xOut}
              y2={yNext}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          ),
        ].filter(Boolean) as React.ReactNode[];
      })}
    </Svg>
  );
}

function BackgroundGradient({ height }: { height: number }) {
  // Subtle dark gradient + faint vignette to hint at "stadium feel" without
  // using a copyrighted photo. Absolutely positioned behind everything.
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height,
      }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0b1424" />
            <Stop offset="0.5" stopColor="#1e293b" />
            <Stop offset="1" stopColor="#0b1424" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" />
      </Svg>
    </View>
  );
}
