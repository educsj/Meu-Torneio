import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useTranslation } from '@/i18n/useTranslation';

interface Props {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void> | void;
}

export function EditTournamentNameModal({
  visible,
  initialName,
  onClose,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setName(initialName);
  }, [visible, initialName]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      onClose();
    } catch (err) {
      Alert.alert('Erro', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center bg-black/50 px-6"
      >
        <View className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-slate-900">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-slate-900 dark:text-white">
              {t('tournament.editTitle')}
            </Text>
            <Pressable
              onPress={onClose}
              className="-mr-1 rounded-full p-1 active:bg-slate-100 dark:active:bg-slate-800"
            >
              <X size={20} color="#64748b" />
            </Pressable>
          </View>

          <TextField
            label={t('newTournament.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('newTournament.namePlaceholder')}
            autoFocus
          />

          <View className="mt-5">
            <Button
              label={t('common.save')}
              onPress={handleSave}
              disabled={saving || !name.trim() || name.trim() === initialName}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
