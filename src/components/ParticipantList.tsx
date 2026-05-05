import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Trash2, UserPlus, Users } from 'lucide-react-native';

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

  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    load(tournamentId);
  }, [tournamentId, load]);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await add(tournamentId, trimmed);
      setName('');
    } catch (err) {
      Alert.alert('Erro', (err as Error).message);
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
      <View className="mb-4 flex-row items-center gap-2">
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

      {participants.length > 0 ? (
        <Text className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {participants.length === 1
            ? t('participants.count.one')
            : t('participants.count.other', { count: participants.length })}
        </Text>
      ) : null}

      <FlatList
        data={participants}
        keyExtractor={(item) => String(item.id)}
        ItemSeparatorComponent={() => (
          <View className="h-px bg-slate-100 dark:bg-slate-800" />
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
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
        }
        renderItem={({ item, index }) => (
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center gap-3">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950">
                <Text className="text-sm font-semibold text-brand-700 dark:text-brand-200">
                  {index + 1}
                </Text>
              </View>
              <Text className="text-base text-slate-900 dark:text-slate-100">
                {item.name}
              </Text>
            </View>
            <Pressable
              onPress={() => handleRemove(item.id)}
              className="rounded-full p-2 active:bg-red-50 dark:active:bg-red-950"
            >
              <Trash2 size={18} color="#dc2626" />
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
