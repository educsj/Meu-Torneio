import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
  allowDraws?: boolean;
  onClose: () => void;
  onSave: (scoreA: number, scoreB: number) => Promise<void> | void;
  onClear: () => Promise<void> | void;
  onSaveSchedule: (
    scheduledAt: string | null,
    location: string | null
  ) => Promise<void> | void;
}

export function ScoreEntryModal({
  visible,
  match,
  participantA,
  participantB,
  allowDraws = false,
  onClose,
  onSave,
  onClear,
  onSaveSchedule,
}: Props) {
  const { t } = useTranslation();
  const [scoreAStr, setScoreAStr] = useState('');
  const [scoreBStr, setScoreBStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [locationStr, setLocationStr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!match) return;
    setScoreAStr(match.scoreA == null ? '' : String(match.scoreA));
    setScoreBStr(match.scoreB == null ? '' : String(match.scoreB));
    const parsed = match.scheduledAt
      ? splitIsoForInputs(match.scheduledAt)
      : { dateStr: '', timeStr: '' };
    setDateStr(parsed.dateStr);
    setTimeStr(parsed.timeStr);
    setLocationStr(match.location ?? '');
  }, [match]);

  const scoreFilled = scoreAStr.trim() !== '' && scoreBStr.trim() !== '';
  const scoreValid =
    scoreFilled &&
    Number.isFinite(Number(scoreAStr)) &&
    Number.isFinite(Number(scoreBStr));

  const initialDate = match?.scheduledAt
    ? splitIsoForInputs(match.scheduledAt).dateStr
    : '';
  const initialTime = match?.scheduledAt
    ? splitIsoForInputs(match.scheduledAt).timeStr
    : '';
  const initialLocation = match?.location ?? '';
  const scheduleChanged =
    dateStr !== initialDate ||
    timeStr !== initialTime ||
    locationStr.trim() !== initialLocation.trim();

  const initialScoreA = match?.scoreA == null ? '' : String(match.scoreA);
  const initialScoreB = match?.scoreB == null ? '' : String(match.scoreB);
  const scoreChanged =
    scoreAStr !== initialScoreA || scoreBStr !== initialScoreB;

  const canSave =
    !!participantA &&
    !!participantB &&
    ((scoreValid && scoreChanged) ||
      (scheduleChanged && (dateStr === '' || isValidDate(dateStr))) &&
        (timeStr === '' || isValidTime(timeStr)));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist whichever section actually changed. Score section requires
      // both fields filled and numeric; schedule fields are independently
      // optional (empty = clear).
      if (scoreChanged && scoreValid) {
        const a = Number(scoreAStr);
        const b = Number(scoreBStr);
        if (!allowDraws && a === b) {
          Alert.alert(t('matches.drawNotAllowed'));
          return;
        }
        await onSave(a, b);
      } else if (scoreChanged && !scoreValid && scoreFilled) {
        Alert.alert(t('matches.scoreInvalid'));
        return;
      }

      if (scheduleChanged) {
        if (dateStr !== '' && !isValidDate(dateStr)) {
          Alert.alert(t('matches.dateInvalid'));
          return;
        }
        if (timeStr !== '' && !isValidTime(timeStr)) {
          Alert.alert(t('matches.timeInvalid'));
          return;
        }
        const iso = combineToIso(dateStr, timeStr);
        const loc = locationStr.trim() === '' ? null : locationStr.trim();
        await onSaveSchedule(iso, loc);
      }
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
        <View className="max-h-[85%] w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900">
          <View className="flex-row items-center justify-between p-5 pb-3">
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

          <ScrollView className="px-5" keyboardShouldPersistTaps="handled">
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

            <View className="my-5 h-px bg-slate-100 dark:bg-slate-800" />

            <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('matches.schedule')}
            </Text>
            <View className="gap-3">
              <View className="flex-row gap-3">
                <DateTimeField
                  label={t('matches.date')}
                  placeholder="DD/MM/AAAA"
                  value={dateStr}
                  onChangeText={(v) =>
                    setDateStr(maskDate(v))
                  }
                  maxLength={10}
                  flex={1.4}
                />
                <DateTimeField
                  label={t('matches.time')}
                  placeholder="HH:MM"
                  value={timeStr}
                  onChangeText={(v) =>
                    setTimeStr(maskTime(v))
                  }
                  maxLength={5}
                  flex={1}
                />
              </View>
              <View>
                <Text className="mb-1 text-xs text-slate-600 dark:text-slate-400">
                  {t('matches.location')}
                </Text>
                <TextInput
                  value={locationStr}
                  onChangeText={setLocationStr}
                  placeholder={t('matches.locationPlaceholder')}
                  placeholderTextColor="#94a3b8"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </View>
            </View>
          </ScrollView>

          <View className="gap-2 p-5 pt-3">
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

function DateTimeField({
  label,
  placeholder,
  value,
  onChangeText,
  maxLength,
  flex,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  maxLength: number;
  flex: number;
}) {
  return (
    <View style={{ flex }}>
      <Text className="mb-1 text-xs text-slate-600 dark:text-slate-400">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
    </View>
  );
}

/** Format an ISO timestamp (or naive local "YYYY-MM-DDTHH:MM") into the two
 * inputs the modal uses. Returns empty strings if parsing fails so the user
 * can re-enter from scratch. */
function splitIsoForInputs(iso: string): { dateStr: string; timeStr: string } {
  // Accept both "2026-05-15" (date only) and "2026-05-15T19:30" / full ISO.
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!match) return { dateStr: '', timeStr: '' };
  const [, y, mo, d, h, mi] = match;
  return {
    dateStr: `${d}/${mo}/${y}`,
    timeStr: h && mi ? `${h}:${mi}` : '',
  };
}

/** Combine "DD/MM/YYYY" + "HH:MM" into a naive-local ISO-ish string. Either
 * may be empty. Returns null when both empty (= clear schedule). */
function combineToIso(date: string, time: string): string | null {
  if (date === '' && time === '') return null;
  let isoDate = '';
  if (date !== '' && isValidDate(date)) {
    const [d, mo, y] = date.split('/');
    isoDate = `${y}-${mo}-${d}`;
  }
  // If only time is provided without date, fall back to today so the value
  // is at least sortable; users wanting "any day" can leave time blank.
  if (isoDate === '' && time !== '') {
    const today = new Date();
    isoDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(today.getDate()).padStart(2, '0')}`;
  }
  if (time !== '' && isValidTime(time)) {
    return `${isoDate}T${time}`;
  }
  return isoDate;
}

function isValidDate(s: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return false;
  const [d, mo, y] = s.split('/').map(Number);
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  if (y < 1900 || y > 2100) return false;
  // Reject impossible day/month combinations (e.g. 31/02) by reconstructing
  // and checking month/day round-trip.
  const dt = new Date(y, mo - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
  );
}

function isValidTime(s: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(s)) return false;
  const [h, mi] = s.split(':').map(Number);
  return h >= 0 && h <= 23 && mi >= 0 && mi <= 59;
}

function maskDate(input: string): string {
  // Keep only digits; insert "/" after positions 2 and 4. Allows free
  // typing/backspacing without fighting the user.
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function maskTime(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
