import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Trash2, UserPlus, Users } from 'lucide-react-native';

import { EditParticipantNameModal } from '@/components/EditParticipantNameModal';
import { ParticipantBadge } from '@/components/ParticipantBadge';
import { ParticipantBadgePicker } from '@/components/ParticipantBadgePicker';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useTranslation } from '@/i18n/useTranslation';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import type { Participant } from '@/types/tournament';

interface Props {
  tournamentId: number;
}

const EMPTY_PARTICIPANTS: readonly Participant[] = Object.freeze([]);

export function ParticipantList({ tournamentId }: Props) {
  const { t } = useTranslation();
  const participants = useParticipantsStore(
    (s) => s.byTournament[tournamentId] ?? EMPTY_PARTICIPANTS
  ) as Participant[];
  const load = useParticipantsStore((s) => s.load);
  const add = useParticipantsStore((s) => s.add);
  const remove = useParticipantsStore((s) => s.remove);
  const updateIcon = useParticipantsStore((s) => s.updateIcon);
  const rename = useParticipantsStore((s) => s.rename);

  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  // Pre-selected badge for the NEXT add. Persists across additions so the
  // user can stamp out a series of participants with the same color.
  const [draftIcon, setDraftIcon] = useState<string | null>(null);
  const [draftColor, setDraftColor] = useState<string | null>(null);
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);
  // Editing target: id of the participant whose badge is being edited.
  const [editingId, setEditingId] = useState<number | null>(null);
  // Renaming target — separate from the badge edit so users can fix a
  // typo without touching the icon, and vice versa.
  const [renamingId, setRenamingId] = useState<number | null>(null);

  useEffect(() => {
    load(tournamentId);
  }, [tournamentId, load]);

  const editingTarget = editingId
    ? participants.find((p) => p.id === editingId)
    : null;
  const renamingTarget = renamingId
    ? participants.find((p) => p.id === renamingId)
    : null;

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await add(tournamentId, trimmed, {
        icon: draftIcon,
        iconColor: draftColor,
      });
      setName('');
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = (id: number) => {
    Alert.alert(t('participants.deleteTitle'), t('participants.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => remove(tournamentId, id),
      },
    ]);
  };

  return (
    <View className="flex-1">
      <View className="mb-4 gap-2">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setDraftPickerOpen(true)}
            className="rounded-full"
          >
            <ParticipantBadge
              icon={draftIcon}
              iconColor={draftColor}
              name={name || '?'}
              size={36}
            />
          </Pressable>
          <View className="flex-1">
            <TextField
              value={name}
              onChangeText={setName}
              placeholder={t('participants.placeholder')}
            />
          </View>
          <View>
            <Button
              label={t('common.create')}
              onPress={handleAdd}
              disabled={adding || !name.trim()}
              leading={<UserPlus size={16} color="#fff" />}
            />
          </View>
        </View>
      </View>

      {participants.length > 0 ? (
        <Text className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {participants.length === 1
            ? t('participants.count.one')
            : t('participants.count.other', { count: participants.length })}
        </Text>
      ) : null}

      {participants.length === 0 ? (
        <View className="mt-12 items-center">
          <View className="mb-4 rounded-full bg-slate-100 p-5 dark:bg-slate-800">
            <Users size={32} color="#94a3b8" />
          </View>
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {t('participants.empty')}
          </Text>
          <Text className="mt-1 px-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('participants.emptyDescription')}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {participants.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? (
                <View className="h-px bg-slate-100 dark:bg-slate-800" />
              ) : null}
              <View className="flex-row items-center justify-between py-3">
                <View className="flex-1 flex-row items-center gap-3">
                  <Pressable onPress={() => setEditingId(item.id)}>
                    <ParticipantBadge
                      icon={item.icon}
                      iconColor={item.iconColor}
                      name={item.name}
                      size={36}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => setRenamingId(item.id)}
                    className="flex-1"
                  >
                    <Text
                      className="text-base text-slate-900 dark:text-slate-100"
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => handleRemove(item.id)}
                  className="rounded-full p-2 active:bg-red-50 dark:active:bg-red-950"
                >
                  <Trash2 size={18} color="#dc2626" />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <ParticipantBadgePicker
        visible={draftPickerOpen}
        title={t('badgePicker.titleNew')}
        initialIcon={draftIcon}
        initialColor={draftColor}
        onClose={() => setDraftPickerOpen(false)}
        onSave={(icon, color) => {
          setDraftIcon(icon);
          setDraftColor(color);
          setDraftPickerOpen(false);
        }}
      />

      <ParticipantBadgePicker
        visible={editingTarget != null}
        title={editingTarget?.name ?? ''}
        initialIcon={editingTarget?.icon ?? null}
        initialColor={editingTarget?.iconColor ?? null}
        onClose={() => setEditingId(null)}
        onSave={(icon, color) => {
          if (editingId != null) {
            updateIcon(tournamentId, editingId, icon, color);
          }
          setEditingId(null);
        }}
      />

      <EditParticipantNameModal
        visible={renamingTarget != null}
        initialName={renamingTarget?.name ?? ''}
        onClose={() => setRenamingId(null)}
        onSave={async (next) => {
          if (renamingId != null) {
            await rename(tournamentId, renamingId, next);
          }
        }}
      />
    </View>
  );
}
