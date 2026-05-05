import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  GitBranch,
  ListOrdered,
  Pencil,
  Shuffle,
  Swords,
  Trash2,
  Users,
} from 'lucide-react-native';

import { ExportTournamentButton } from '@/components/BackupActions';
import { EditTournamentNameModal } from '@/components/EditTournamentNameModal';
import { ParticipantList } from '@/components/ParticipantList';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useTranslation } from '@/i18n/useTranslation';
import { useMatchesStore } from '@/stores/useMatchesStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useTournamentsStore } from '@/stores/useTournamentsStore';
import type {
  Match,
  Participant,
  Tournament,
  TournamentType,
} from '@/types/tournament';

const TYPE_LABEL_KEY: Record<TournamentType, string> = {
  single_elimination: 'singleElimination',
  round_robin: 'roundRobin',
  groups_knockout: 'groupsKnockout',
  league_playoff: 'leaguePlayoff',
  custom: 'custom',
};

const EMPTY_PARTICIPANTS: readonly Participant[] = Object.freeze([]);
const EMPTY_MATCHES: readonly Match[] = Object.freeze([]);

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const { t } = useTranslation();
  const router = useRouter();

  const fetchById = useTournamentsStore((s) => s.fetchById);
  const removeTournament = useTournamentsStore((s) => s.remove);
  const renameTournament = useTournamentsStore((s) => s.rename);
  const tournament = useTournamentsStore((s) =>
    s.tournaments.find((tt) => tt.id === tournamentId)
  );
  const clearParticipants = useParticipantsStore(
    (s) => s.clearForTournament
  );
  const participants = useParticipantsStore(
    (s) => s.byTournament[tournamentId] ?? EMPTY_PARTICIPANTS
  ) as Participant[];

  const matches = useMatchesStore(
    (s) => s.byTournament[tournamentId] ?? EMPTY_MATCHES
  ) as Match[];
  const loadMatches = useMatchesStore((s) => s.load);
  const generateBracket = useMatchesStore((s) => s.generate);
  const clearMatches = useMatchesStore((s) => s.clearForTournament);

  const [loadAttempted, setLoadAttempted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) {
      setLoadAttempted(true);
      return;
    }
    let cancelled = false;
    fetchById(tournamentId).finally(() => {
      if (!cancelled) setLoadAttempted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, fetchById]);

  useEffect(() => {
    if (Number.isFinite(tournamentId)) {
      loadMatches(tournamentId);
    }
  }, [tournamentId, loadMatches]);

  const handleBack = useCallback(() => router.back(), [router]);

  const handleDelete = useCallback(() => {
    Alert.alert(t('tournament.deleteTitle'), t('tournament.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await removeTournament(tournamentId);
          clearParticipants(tournamentId);
          clearMatches(tournamentId);
          router.back();
        },
      },
    ]);
  }, [
    t,
    removeTournament,
    clearParticipants,
    clearMatches,
    tournamentId,
    router,
  ]);

  const runGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await generateBracket(tournamentId);
    } catch (err) {
      Alert.alert('Erro', (err as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [generateBracket, tournamentId]);

  const handleGenerate = useCallback(() => {
    if (matches.length > 0) {
      Alert.alert(
        t('matches.regenerateConfirmTitle'),
        t('matches.regenerateConfirmMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.confirm'),
            style: 'destructive',
            onPress: runGenerate,
          },
        ]
      );
    } else {
      runGenerate();
    }
  }, [matches.length, t, runGenerate]);

  if (loadAttempted && !tournament) {
    return (
      <Screen>
        <NotFoundHeader title={t('tournament.notFound')} onBack={handleBack} />
      </Screen>
    );
  }

  if (!tournament) {
    return <Screen />;
  }

  const isSingleElim = tournament.type === 'single_elimination';
  const isRoundRobin = tournament.type === 'round_robin';
  const isGroups = tournament.type === 'groups_knockout';
  const isLeaguePlayoff = tournament.type === 'league_playoff';
  const isCustom = tournament.type === 'custom';
  // For custom tournaments we can't tell from the type alone whether to
  // surface standings/groups; for now we surface standings (most custom
  // configs use a league phase) and skip the groups view (multi-group is
  // an advanced case). Polish lands when the wizard exposes more shapes.
  const showStandings = isRoundRobin || isLeaguePlayoff || isCustom;
  const minParticipants =
    isGroups || isLeaguePlayoff || isCustom ? 4 : 2;
  const enoughParticipants = participants.length >= minParticipants;
  const canGenerate = enoughParticipants;
  const hasMatches = matches.length > 0;

  return (
    <Screen scroll>
      <Header
        tournament={tournament}
        onBack={handleBack}
        onDelete={handleDelete}
        onEdit={() => setEditingName(true)}
      />

      <View className="my-4 gap-2">
        <NavButton
          label={t('tournament.matches')}
          icon={<Swords size={18} color="#475569" />}
          onPress={() =>
            router.push({
              pathname: '/torneios/[id]/partidas',
              params: { id: String(tournamentId) },
            })
          }
        />
        {isSingleElim ? (
          <NavButton
            label={t('tournament.bracket')}
            icon={<GitBranch size={18} color="#475569" />}
            onPress={() =>
              router.push({
                pathname: '/torneios/[id]/chaveamento',
                params: { id: String(tournamentId) },
              })
            }
          />
        ) : null}
        {showStandings ? (
          <NavButton
            label={t('standings.title')}
            icon={<ListOrdered size={18} color="#475569" />}
            onPress={() =>
              router.push({
                pathname: '/torneios/[id]/classificacao',
                params: { id: String(tournamentId) },
              })
            }
          />
        ) : null}
        {isGroups ? (
          <NavButton
            label={t('groups.title')}
            icon={<Users size={18} color="#475569" />}
            onPress={() =>
              router.push({
                pathname: '/torneios/[id]/grupos',
                params: { id: String(tournamentId) },
              })
            }
          />
        ) : null}
      </View>

      <View className="mb-4">
        <Button
          label={
            hasMatches ? t('matches.regenerate') : t('matches.generate')
          }
          onPress={handleGenerate}
          disabled={!canGenerate || generating}
          variant={hasMatches ? 'secondary' : 'primary'}
          leading={
            <Shuffle size={16} color={hasMatches ? '#0f172a' : '#fff'} />
          }
        />
        {!enoughParticipants ? (
          <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {isGroups || isLeaguePlayoff || isCustom
              ? t('matches.needMoreParticipantsGroups')
              : t('matches.needMoreParticipants')}
          </Text>
        ) : null}
      </View>

      <EditTournamentNameModal
        visible={editingName}
        initialName={tournament.name}
        onClose={() => setEditingName(false)}
        onSave={(name) => renameTournament(tournamentId, name)}
      />

      <View className="mt-2">
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('tournament.participants')}
        </Text>
        <ParticipantList tournamentId={tournamentId} />
      </View>

      <View className="mt-6">
        <ExportTournamentButton tournamentId={tournamentId} />
      </View>
    </Screen>
  );
}

function NavButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800"
    >
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className="text-base font-medium text-slate-900 dark:text-slate-100">
          {label}
        </Text>
      </View>
      <ChevronRight size={18} color="#94a3b8" />
    </Pressable>
  );
}

function Header({
  tournament,
  onBack,
  onDelete,
  onEdit,
}: {
  tournament: Tournament;
  onBack: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="pt-6">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onBack}
          className="-ml-2 rounded-full p-2 active:bg-slate-100 dark:active:bg-slate-800"
        >
          <ChevronLeft size={22} color="#475569" />
        </Pressable>
        <View className="flex-row items-center">
          <Pressable
            onPress={onEdit}
            className="rounded-full p-2 active:bg-slate-100 dark:active:bg-slate-800"
          >
            <Pencil size={18} color="#475569" />
          </Pressable>
          <Pressable
            onPress={onDelete}
            className="-mr-2 rounded-full p-2 active:bg-red-50 dark:active:bg-red-950"
          >
            <Trash2 size={20} color="#dc2626" />
          </Pressable>
        </View>
      </View>
      <Text className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
        {tournament.name}
      </Text>
      <View className="mt-2 flex-row gap-2">
        <Badge tone="brand">
          {t(`newTournament.types.${TYPE_LABEL_KEY[tournament.type]}`)}
        </Badge>
        <Badge tone="neutral">
          {t(`tournament.status.${tournament.status}`)}
        </Badge>
      </View>
    </View>
  );
}

function NotFoundHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View className="flex-row items-center pt-6">
      <Pressable
        onPress={onBack}
        className="-ml-2 mr-2 rounded-full p-2 active:bg-slate-100 dark:active:bg-slate-800"
      >
        <ChevronLeft size={22} color="#475569" />
      </Pressable>
      <Text className="text-xl font-bold text-slate-900 dark:text-white">
        {title}
      </Text>
    </View>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
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
      <Text className={`text-xs font-semibold ${styles.text}`}>
        {children}
      </Text>
    </View>
  );
}
