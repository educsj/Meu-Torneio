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

import { ParticipantBadge } from '@/components/ParticipantBadge';
import { useTranslation } from '@/i18n/useTranslation';
import type { Match, Participant } from '@/types/tournament';
import type { StandingRow } from '@/utils/standings';

const SLOT_HEIGHT = 50;
const SLOT_WIDTH = 150;
const COL_GAP = 40;
const CENTER_WIDTH = 220;
const SIDE_PADDING = 16;
const CONNECTOR_COLOR = '#facc15'; // yellow-400 — matches the reference's lines
const TROPHY_COLOR = '#fbbf24';

/** Width the bracket needs at full size, given how many side rounds exist
 *  per half (R1 / QF / SF). Each side round adds one slot column + one
 *  connector. Center occupies a fixed pillar width. Used to fix the
 *  intrinsic width of the captured view so it doesn't get squished by a
 *  narrower parent (which would otherwise make captureRef record a
 *  cropped image). */
function intrinsicWidth(sideRoundCount: number): number {
  return (
    SIDE_PADDING * 2 +
    sideRoundCount * 2 * (SLOT_WIDTH + COL_GAP) +
    CENTER_WIDTH
  );
}

/** Per-group standings the caller passes in for tournaments with a group
 *  phase (groups_knockout, World Cup, anything multi-group). When omitted
 *  the bracket is shown alone. */
export interface ChampionsGroup {
  label: string;
  standings: StandingRow[];
}

interface Props {
  matches: Match[];
  participantsById: Map<number, Participant>;
  /** Tournament name shown above the bracket — provided by the caller so
   *  this component stays a pure layout. */
  title: string;
  /** Optional: per-group standings to render above the bracket. */
  groups?: ChampionsGroup[];
  /** When `groups` is provided, this is the number of qualifiers per group
   *  (top-K advance) — drives the gold highlight on those rows. Default 2. */
  qualifiersPerGroup?: number;
}

const GROUP_CARD_WIDTH = 240;
const GROUP_CARD_GAP = 12;

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
  function ChampionsBracket(
    { matches, participantsById, title, groups, qualifiersPerGroup = 2 },
    ref
  ) {
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
  // Pin the captured view's width so the bracket renders at full natural
  // size. The preview ScrollView lets the user pan; without this the
  // parent flex would squeeze columns and captureRef would record a
  // cropped image.
  const contentWidth = intrinsicWidth(sideRounds.length);

  // Estimate the group section's vertical footprint so the background
  // gradient extends behind it. Groups wrap into rows of `cardsPerRow`,
  // each row ~38px header + ~28px per standings line + 24px padding.
  const groupCount = groups?.length ?? 0;
  const cardsPerRow = Math.max(
    1,
    Math.floor(
      (contentWidth - SIDE_PADDING * 2 + GROUP_CARD_GAP) /
        (GROUP_CARD_WIDTH + GROUP_CARD_GAP)
    )
  );
  const groupRows = Math.ceil(groupCount / cardsPerRow);
  const maxRowsTeams =
    groups && groups.length > 0
      ? Math.max(...groups.map((g) => g.standings.length))
      : 0;
  const groupSectionHeight =
    groupCount > 0 ? groupRows * (40 + maxRowsTeams * 26 + 24) + 60 : 0;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ backgroundColor: '#0b1424', width: contentWidth }}
    >
      <BackgroundGradient height={totalHeight + 220 + groupSectionHeight} />

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

      {groups && groups.length > 0 ? (
        <GroupStageSection
          groups={groups}
          qualifiersPerGroup={qualifiersPerGroup}
          containerWidth={contentWidth}
          groupHeader={t('image.groupHeader')}
        />
      ) : null}

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
        participant={a}
        name={a?.name ?? (aIsBye ? byeLabel : tbdLabel)}
        score={match.scoreA}
        won={aWon}
        placeholder={!a}
      />
      <View style={{ height: 1, backgroundColor: '#0b1424' }} />
      <SlotSide
        participant={b}
        name={b?.name ?? (bIsBye ? byeLabel : tbdLabel)}
        score={match.scoreB}
        won={bWon}
        placeholder={!b}
      />
    </View>
  );
}

function SlotSide({
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
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        backgroundColor: won ? 'rgba(250, 204, 21, 0.15)' : 'transparent',
      }}
    >
      {participant ? (
        <View style={{ marginRight: 6 }}>
          <ParticipantBadge
            icon={participant.icon}
            iconColor={participant.iconColor}
            name={participant.name}
            size={22}
          />
        </View>
      ) : null}
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
          participant={a}
          name={a?.name ?? tbdLabel}
          score={match.scoreA}
          won={aWon}
          placeholder={!a}
        />
        <View style={{ height: 1, backgroundColor: '#0b1424' }} />
        <SlotSide
          participant={b}
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

  // Build a flat, deduplicated list of <Line/> children with explicit
  // unique keys. The previous flatMap-with-filter pattern produced a
  // sparse array (the conditional `null` for the outward stub) that
  // React's reconciler sometimes keyed by index, leading to duplicate
  // `.$N` keys when multiple connectors rendered in the same scope.
  const lines: React.ReactNode[] = [];
  for (let j = 0; j < pairs; j++) {
    const yA = (2 * j + 0.5) * slotHeight;
    const yB = (2 * j + 1.5) * slotHeight;
    const yNext = (2 * j + 1) * slotHeight;
    const x0 = isRight ? 0 : COL_GAP;
    const xMid = halfGap;
    const xOut = isRight ? COL_GAP : 0;
    lines.push(
      <Line
        key={`p${j}-a`}
        x1={x0}
        y1={yA}
        x2={xMid}
        y2={yA}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />,
      <Line
        key={`p${j}-b`}
        x1={x0}
        y1={yB}
        x2={xMid}
        y2={yB}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />,
      <Line
        key={`p${j}-v`}
        x1={xMid}
        y1={yA}
        x2={xMid}
        y2={yB}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
    if (!isLast) {
      // Outward stub feeding the next column. Skipped on the connector
      // closest to the center so the final card isn't crossed.
      lines.push(
        <Line
          key={`p${j}-n`}
          x1={xMid}
          y1={yNext}
          x2={xOut}
          y2={yNext}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
  }

  return (
    <Svg width={COL_GAP} height={totalHeight}>
      {lines}
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

/**
 * Group-stage section that sits above the bracket on the Champions image.
 * Each group is a small dark card with the standings table — gold-tinted
 * rows for the qualifying positions (top-K based on `qualifiersPerGroup`),
 * neutral rows for the eliminated teams. Cards wrap into rows so the
 * section grows downward, never sideways.
 */
function GroupStageSection({
  groups,
  qualifiersPerGroup,
  containerWidth,
  groupHeader,
}: {
  groups: ChampionsGroup[];
  qualifiersPerGroup: number;
  containerWidth: number;
  groupHeader: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: SIDE_PADDING,
        paddingBottom: 24,
        width: containerWidth,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: GROUP_CARD_GAP,
          justifyContent: 'center',
        }}
      >
        {groups.map((g) => (
          <View
            key={g.label}
            style={{
              width: GROUP_CARD_WIDTH,
              backgroundColor: '#1e293b',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#334155',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: '#0f172a',
                borderBottomWidth: 1,
                borderBottomColor: '#334155',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  color: '#facc15',
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1.5,
                }}
              >
                {`${groupHeader} ${g.label}`.toUpperCase()}
              </Text>
              <Text
                style={{
                  color: '#94a3b8',
                  fontSize: 10,
                  fontWeight: '600',
                  letterSpacing: 1,
                }}
              >
                P
              </Text>
            </View>
            {g.standings.map((row, idx) => {
              const qualifies = idx < qualifiersPerGroup;
              return (
                <GroupStandingRow
                  key={row.participantId}
                  rank={idx + 1}
                  row={row}
                  qualifies={qualifies}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function GroupStandingRow({
  rank,
  row,
  qualifies,
}: {
  rank: number;
  row: StandingRow;
  qualifies: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: qualifies
          ? 'rgba(250, 204, 21, 0.10)'
          : 'transparent',
        borderLeftWidth: 3,
        borderLeftColor: qualifies ? '#facc15' : 'transparent',
      }}
    >
      <Text
        style={{
          width: 18,
          fontSize: 11,
          color: qualifies ? '#fde68a' : '#64748b',
          fontWeight: '700',
        }}
      >
        {rank}
      </Text>
      <Text
        style={{
          flex: 1,
          fontSize: 12,
          color: qualifies ? '#fef3c7' : '#e2e8f0',
          fontWeight: qualifies ? '600' : '500',
        }}
        numberOfLines={1}
      >
        {row.name}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: qualifies ? '#fde68a' : '#94a3b8',
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          minWidth: 22,
          textAlign: 'right',
        }}
      >
        {row.points}
      </Text>
    </View>
  );
}
