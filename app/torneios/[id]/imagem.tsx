import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Download, Share2 } from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { ShareableTournamentSummary } from '@/components/ShareableTournamentSummary';
import { Button } from '@/components/ui/Button';
import { listParticipants } from '@/db/participants';
import { listPhases } from '@/db/phases';
import { useTranslation } from '@/i18n/useTranslation';
import { useMatchesStore } from '@/stores/useMatchesStore';
import { useTournamentsStore } from '@/stores/useTournamentsStore';
import type { Match, Participant, Phase } from '@/types/tournament';
import { suggestedBackupFilename } from '@/utils/exportImport';

const EMPTY_MATCHES: readonly Match[] = Object.freeze([]);

export default function TournamentImageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const router = useRouter();
  const { t } = useTranslation();

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
  const captureTargetRef = useRef<View>(null);

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
            <ChevronLeft size={22} color="#475569" />
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
          <ChevronLeft size={22} color="#475569" />
        </Pressable>
        <Text className="text-base font-semibold text-slate-900 dark:text-white">
          {t('image.title')}
        </Text>
        <View className="w-9" />
      </View>

      <Text className="px-5 pb-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
        {t('image.previewHint', { filename })}
      </Text>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-3 pb-4"
      >
        <View
          className="overflow-hidden rounded-2xl"
        >
          <ShareableTournamentSummary
            ref={captureTargetRef}
            tournament={tournament}
            participants={participants}
            matches={matches}
            phases={phases}
          />
        </View>
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
          leading={<Download size={16} color="#0f172a" />}
        />
      </View>
    </SafeAreaView>
  );
}
