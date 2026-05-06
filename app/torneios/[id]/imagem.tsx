import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Download, Share2 } from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { ChampionsBracket } from '@/components/ChampionsBracket';
import { ShareableTournamentSummary } from '@/components/ShareableTournamentSummary';
import { Button } from '@/components/ui/Button';
import { listParticipants } from '@/db/participants';
import { listPhases } from '@/db/phases';
import { useThemeIcon } from '@/hooks/useThemeIcon';
import { useTranslation } from '@/i18n/useTranslation';
import { useMatchesStore } from '@/stores/useMatchesStore';
import { useTournamentsStore } from '@/stores/useTournamentsStore';
import type { Match, Participant, Phase } from '@/types/tournament';
import {
  GRAND_FINAL_LABEL,
  LOSERS_BRACKET_LABEL,
  THIRD_PLACE_LABEL,
  WINNERS_BRACKET_LABEL,
} from '@/utils/bracket';
import { suggestedBackupFilename } from '@/utils/exportImport';

type ImageStyle = 'simple' | 'champions';

/** Pull just the symmetric-tree-friendly knockout matches for the Champions
 *  layout — excludes 3rd-place, DE WB/LB/GF, and bracket-reset matches. */
function selectChampionsBracketMatches(matches: Match[]): Match[] {
  return matches
    .filter(
      (m) =>
        (m.stage === 'main' || m.stage === 'knockout') &&
        m.groupLabel !== THIRD_PLACE_LABEL &&
        m.groupLabel !== WINNERS_BRACKET_LABEL &&
        m.groupLabel !== LOSERS_BRACKET_LABEL &&
        m.groupLabel !== GRAND_FINAL_LABEL
    )
    .sort((a, b) => a.round - b.round || a.id - b.id);
}

/** True when the tournament has a single-elim bracket of 4/8/16 slots —
 *  the shapes the symmetric Champions layout knows how to draw. */
function supportsChampionsLayout(matches: Match[]): boolean {
  const ms = selectChampionsBracketMatches(matches);
  if (ms.length === 0) return false;
  const r1 = ms.filter((m) => m.round === 1).length;
  return r1 === 2 || r1 === 4 || r1 === 8; // 4 / 8 / 16 teams
}

const EMPTY_MATCHES: readonly Match[] = Object.freeze([]);

export default function TournamentImageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const router = useRouter();
  const { t } = useTranslation();
  const icon = useThemeIcon();

  const tournament = useTournamentsStore((s) =>
    s.tournaments.find((tt) => tt.id === tournamentId)
  );
  const fetchById = useTournamentsStore((s) => s.fetchById);
  const matches = useMatchesStore(
    (s) => s.byTournament[tournamentId] ?? EMPTY_MATCHES
  ) as Match[];
  const loadMatches = useMatchesStore((s) => s.load);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [style, setStyle] = useState<ImageStyle>('simple');
  const captureTargetRef = useRef<View>(null);

  const championsAvailable = useMemo(
    () => supportsChampionsLayout(matches),
    [matches]
  );
  const championsMatches = useMemo(
    () => selectChampionsBracketMatches(matches),
    [matches]
  );
  const participantsById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  // If the user picks Champions and then the bracket gets regenerated to a
  // shape that doesn't support it, snap back to Simple so the preview isn't
  // suddenly empty.
  useEffect(() => {
    if (style === 'champions' && !championsAvailable) {
      setStyle('simple');
    }
  }, [style, championsAvailable]);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    let cancelled = false;
    fetchById(tournamentId);
    loadMatches(tournamentId);
    listParticipants(tournamentId).then((list) => {
      if (cancelled) return;
      setParticipants(list);
    });
    listPhases(tournamentId).then((list) => {
      if (cancelled) return;
      setPhases(list);
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, fetchById, loadMatches]);

  const handleShare = async () => {
    if (!tournament) return;
    setSharing(true);
    try {
      const uri = await captureRef(captureTargetRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(t('image.shareUnavailable'));
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: t('image.shareDialogTitle'),
        // Hint for the resulting filename in apps that respect it.
        UTI: 'public.png',
      });
    } catch (err) {
      Alert.alert('Erro', (err as Error).message);
    } finally {
      setSharing(false);
    }
  };

  const handleSaveToGallery = async () => {
    if (!tournament) return;
    setSaving(true);
    try {
      // saveToLibraryAsync requires WRITE permission on Android; on iOS it
      // grants write-only access through the limited photo picker.
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          t('image.saveDeniedTitle'),
          t('image.saveDeniedMessage')
        );
        return;
      }
      const uri = await captureRef(captureTargetRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(t('image.savedTitle'), t('image.savedMessage'));
    } catch (err) {
      Alert.alert('Erro', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!tournament) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        className="flex-1 bg-white dark:bg-slate-950"
      >
        <View className="flex-row items-center px-5 pt-2">
          <Pressable
            onPress={() => router.back()}
            className="-ml-2 mr-2 rounded-full p-2 active:bg-slate-100 dark:active:bg-slate-800"
          >
            <ChevronLeft size={22} color={icon.secondary} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const filename = suggestedBackupFilename(tournament.name).replace(
    /\.json$/,
    '.png'
  );

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 bg-slate-100 dark:bg-slate-900"
    >
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Pressable
          onPress={() => router.back()}
          className="-ml-2 rounded-full p-2 active:bg-slate-200 dark:active:bg-slate-800"
        >
          <ChevronLeft size={22} color={icon.secondary} />
        </Pressable>
        <Text className="text-base font-semibold text-slate-900 dark:text-white">
          {t('image.title')}
        </Text>
        <View className="w-9" />
      </View>

      <Text className="px-5 pb-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
        {t('image.previewHint', { filename })}
      </Text>

      {championsAvailable ? (
        <View className="flex-row gap-2 px-5 pb-2">
          <StyleChip
            label={t('image.styleSimple')}
            selected={style === 'simple'}
            onPress={() => setStyle('simple')}
          />
          <StyleChip
            label={t('image.styleChampions')}
            selected={style === 'champions'}
            onPress={() => setStyle('champions')}
          />
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-3 pb-4"
      >
        {style === 'champions' && championsAvailable ? (
          // Champions bracket renders at full natural width (~1000-1400px
          // depending on the size of the bracket) — let the user pan
          // horizontally to preview, and let captureRef record the full
          // intrinsic width regardless of the visible viewport.
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            <View className="rounded-2xl">
              <ChampionsBracket
                ref={captureTargetRef}
                matches={championsMatches}
                participantsById={participantsById}
                title={tournament.name}
              />
            </View>
          </ScrollView>
        ) : (
          <View className="overflow-hidden rounded-2xl">
            <ShareableTournamentSummary
              ref={captureTargetRef}
              tournament={tournament}
              participants={participants}
              matches={matches}
              phases={phases}
            />
          </View>
        )}
      </ScrollView>

      <View className="gap-2 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <Button
          label={t('image.share')}
          onPress={handleShare}
          disabled={sharing || saving}
          leading={<Share2 size={16} color="#fff" />}
        />
        <Button
          label={t('image.saveToGallery')}
          onPress={handleSaveToGallery}
          disabled={sharing || saving}
          variant="secondary"
          leading={<Download size={16} color={icon.primary} />}
        />
      </View>
    </SafeAreaView>
  );
}

function StyleChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-xl border px-3 py-2 ${
        selected
          ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <Text
        className={`text-center text-sm ${
          selected
            ? 'font-semibold text-brand-700 dark:text-brand-200'
            : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
