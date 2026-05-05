import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/useTranslation';
import type { Match, Participant } from '@/types/tournament';

interface Props {
  visible: boolean;
  match: Match | null;
  participantA: Participant | null;
  participantB: Participant | null;
  onClose: () => void;
  onSave: (scoreA: number, scoreB: number) => Promise<void> | void;
  onClear: () => Promise<void> | void;
}

export function ScoreEntryModal({
  visible,
  match,
  participantA,
  participantB,
  onClose,
  onSave,
  onClear,
}: Props) {
  const { t } = useTranslation();
  const [scoreAStr, setScoreAStr] = useState('');
  const [scoreBStr, setScoreBStr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!match) return;
    setScoreAStr(match.scoreA == null ? '' : String(match.scoreA));
    setScoreBStr(match.scoreB == null ? '' : String(match.scoreB));
  }, [match]);

  const canSave =
    !!participantA &&
    !!participantB &&
    scoreAStr.trim() !== '' &&
    scoreBStr.trim() !== '' &&
    Number.isFinite(Number(scoreAStr)) &&
    Number.isFinite(Number(scoreBStr));

  const handleSave = async () => {
    const a = Number(scoreAStr);
    const b = Number(scoreBStr);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      Alert.alert(t('matches.scoreInvalid'));
      return;
    }
    if (a === b) {
      Alert.alert(t('matches.drawNotAllowed'));
      return;
    }
    setSaving(true);
    try {
      await onSave(a, b);
      onClose();
    } catch (err) {
      Alert.alert('Erro', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await onClear();
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
              {t('matches.scoreEntry')}
            </Text>
            <Pressable
              onPress={onClose}
              className="-mr-1 rounded-full p-1 active:bg-slate-100 dark:active:bg-slate-800"
            >
              <X size={20} color="#64748b" />
            </Pressable>
          </View>

          {!participantA || !participantB ? (
            <Text className="text-sm text-amber-700 dark:text-amber-300">
              {t('matches.noOpponent')}
            </Text>
          ) : (
            <View className="gap-3">
              <ScoreField
                label={participantA.name}
                value={scoreAStr}
                onChangeText={setScoreAStr}
              />
              <ScoreField
                label={participantB.name}
                value={scoreBStr}
                onChangeText={setScoreBStr}
              />
            </View>
          )}

          <View className="mt-5 gap-2">
            <Button
              label={t('matches.save')}
              onPress={handleSave}
              disabled={!canSave || saving}
            />
            {match?.scoreA != null || match?.scoreB != null ? (
              <Button
                label={t('matches.clearResult')}
                onPress={handleClear}
                variant="ghost"
                disabled={saving}
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ScoreField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text
        className="flex-1 text-base text-slate-900 dark:text-slate-100"
        numberOfLines={1}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={3}
        className="w-16 rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-lg font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        placeholder="–"
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}
