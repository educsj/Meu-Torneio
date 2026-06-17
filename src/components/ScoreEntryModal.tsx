import { useEffect, useRef, useState } from 'react';
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
import { Plus, Trash2, X } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/useTranslation';
import type {
  Match,
  Participant,
  Scorer,
  ScorerInput,
} from '@/types/tournament';

/** Editable scorer row in the modal. `side` ties it to participant A or B. */
interface ScorerRow {
  key: string;
  side: 'A' | 'B';
  name: string;
  goalsStr: string;
}

interface Props {
  visible: boolean;
  match: Match | null;
  participantA: Participant | null;
  participantB: Participant | null;
  allowDraws?: boolean;
  /** Existing scorers for the open match (empty when none recorded yet). */
  scorers?: Scorer[];
  onClose: () => void;
  onSave: (
    scoreA: number,
    scoreB: number,
    options?: { walkover?: boolean }
  ) => Promise<void> | void;
  onClear: () => Promise<void> | void;
  onSaveSchedule: (
    scheduledAt: string | null,
    location: string | null
  ) => Promise<void> | void;
  /** Persist the full scorer list for the match (replaces existing). Optional
   *  — when omitted the scorers section is hidden. */
  onSaveScorers?: (rows: ScorerInput[]) => Promise<void> | void;
}

/** Conventional forfeit score across formats — 3-0 is the standard
 *  walkover result in both football and volleyball. */
const WALKOVER_WIN = 3;
const WALKOVER_LOSS = 0;

export function ScoreEntryModal({
  visible,
  match,
  participantA,
  participantB,
  allowDraws = false,
  scorers,
  onClose,
  onSave,
  onClear,
  onSaveSchedule,
  onSaveScorers,
}: Props) {
  const { t } = useTranslation();
  const [scoreAStr, setScoreAStr] = useState('');
  const [scoreBStr, setScoreBStr] = useState('');
  const [walkover, setWalkover] = useState(false);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [locationStr, setLocationStr] = useState('');
  const [scorerRows, setScorerRows] = useState<ScorerRow[]>([]);
  const [scorersDirty, setScorersDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const keyCounter = useRef(0);
  const nextKey = () => `s${keyCounter.current++}`;

  useEffect(() => {
    if (!match) return;
    setScoreAStr(match.scoreA == null ? '' : String(match.scoreA));
    setScoreBStr(match.scoreB == null ? '' : String(match.scoreB));
    setWalkover(match.walkover);
    const parsed = match.scheduledAt
      ? splitIsoForInputs(match.scheduledAt)
      : { dateStr: '', timeStr: '' };
    setDateStr(parsed.dateStr);
    setTimeStr(parsed.timeStr);
    setLocationStr(match.location ?? '');
    // Seed scorer rows from the persisted list, mapping participant id → side.
    const seeded: ScorerRow[] = (scorers ?? []).map((s) => ({
      key: nextKey(),
      side: s.participantId === match.participantBId ? 'B' : 'A',
      name: s.name,
      goalsStr: String(s.goals),
    }));
    setScorerRows(seeded);
    setScorersDirty(false);
  }, [match, scorers]);

  const addScorer = (side: 'A' | 'B') => {
    setScorerRows((rows) => [
      ...rows,
      { key: nextKey(), side, name: '', goalsStr: '1' },
    ]);
    setScorersDirty(true);
  };
  const updateScorer = (key: string, partial: Partial<ScorerRow>) => {
    setScorerRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...partial } : r))
    );
    setScorersDirty(true);
  };
  const removeScorer = (key: string) => {
    setScorerRows((rows) => rows.filter((r) => r.key !== key));
    setScorersDirty(true);
  };

  const markWalkover = (sideAWins: boolean) => {
    setScoreAStr(String(sideAWins ? WALKOVER_WIN : WALKOVER_LOSS));
    setScoreBStr(String(sideAWins ? WALKOVER_LOSS : WALKOVER_WIN));
    setWalkover(true);
  };

  // If the user manually edits the score after marking W.O., it stops
  // being a walkover. Track whether the current score still represents
  // the original W.O. action.
  const onScoreAChange = (v: string) => {
    if (walkover) setWalkover(false);
    setScoreAStr(v.replace(/[^0-9]/g, ''));
  };
  const onScoreBChange = (v: string) => {
    if (walkover) setWalkover(false);
    setScoreBStr(v.replace(/[^0-9]/g, ''));
  };

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
  const initialWalkover = match?.walkover ?? false;
  const scoreChanged =
    scoreAStr !== initialScoreA ||
    scoreBStr !== initialScoreB ||
    walkover !== initialWalkover;

  const canSave =
    !!participantA &&
    !!participantB &&
    ((scoreValid && scoreChanged) ||
      (scorersDirty && onSaveScorers != null) ||
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
        if (!walkover && !allowDraws && a === b) {
          Alert.alert(t('matches.drawNotAllowed'));
          return;
        }
        await onSave(a, b, { walkover });
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

      if (scorersDirty && onSaveScorers && participantA && participantB) {
        const rows: ScorerInput[] = scorerRows
          .map((r) => ({
            participantId: r.side === 'A' ? participantA.id : participantB.id,
            name: r.name.trim(),
            goals: Number(r.goalsStr) || 0,
          }))
          .filter((r) => r.name.length > 0 && r.goals > 0);
        await onSaveScorers(rows);
      }
      onClose();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
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
      Alert.alert(t('common.error'), (err as Error).message);
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
                  onChangeText={onScoreAChange}
                />
                <ScoreField
                  label={participantB.name}
                  value={scoreBStr}
                  onChangeText={onScoreBChange}
                />
                {walkover ? (
                  <View className="rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950">
                    <Text className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                      {t('matches.walkoverActive')}
                    </Text>
                  </View>
                ) : null}
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => markWalkover(true)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-2 py-2 active:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <Text
                      className="text-center text-xs font-medium text-slate-700 dark:text-slate-300"
                      numberOfLines={1}
                    >
                      {t('matches.walkoverFor', { name: participantA.name })}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => markWalkover(false)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-2 py-2 active:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <Text
                      className="text-center text-xs font-medium text-slate-700 dark:text-slate-300"
                      numberOfLines={1}
                    >
                      {t('matches.walkoverFor', { name: participantB.name })}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {onSaveScorers && participantA && participantB ? (
              <>
                <View className="my-5 h-px bg-slate-100 dark:bg-slate-800" />
                <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('scorers.title')}
                </Text>
                <View className="gap-4">
                  <ScorerSide
                    teamName={participantA.name}
                    rows={scorerRows.filter((r) => r.side === 'A')}
                    onAdd={() => addScorer('A')}
                    onChange={updateScorer}
                    onRemove={removeScorer}
                    t={t}
                  />
                  <ScorerSide
                    teamName={participantB.name}
                    rows={scorerRows.filter((r) => r.side === 'B')}
                    onAdd={() => addScorer('B')}
                    onChange={updateScorer}
                    onRemove={removeScorer}
                    t={t}
                  />
                </View>
              </>
            ) : null}

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

function ScorerSide({
  teamName,
  rows,
  onAdd,
  onChange,
  onRemove,
  t,
}: {
  teamName: string;
  rows: ScorerRow[];
  onAdd: () => void;
  onChange: (key: string, partial: Partial<ScorerRow>) => void;
  onRemove: (key: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <View className="gap-2">
      <Text
        className="text-xs font-medium text-slate-700 dark:text-slate-300"
        numberOfLines={1}
      >
        {teamName}
      </Text>
      {rows.map((row) => (
        <View key={row.key} className="flex-row items-center gap-2">
          <TextInput
            value={row.name}
            onChangeText={(v) => onChange(row.key, { name: v })}
            placeholder={t('scorers.playerPlaceholder')}
            placeholderTextColor="#94a3b8"
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <TextInput
            value={row.goalsStr}
            onChangeText={(v) =>
              onChange(row.key, { goalsStr: v.replace(/[^0-9]/g, '') })
            }
            keyboardType="number-pad"
            maxLength={2}
            className="w-12 rounded-xl border border-slate-300 bg-white px-2 py-2 text-center text-base font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="1"
            placeholderTextColor="#94a3b8"
          />
          <Pressable
            onPress={() => onRemove(row.key)}
            className="rounded-full p-1.5 active:bg-red-50 dark:active:bg-red-950"
          >
            <Trash2 size={16} color="#dc2626" />
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={onAdd}
        className="flex-row items-center gap-1.5 self-start rounded-lg px-1 py-1 active:bg-slate-100 dark:active:bg-slate-800"
      >
        <Plus size={14} color="#475569" />
        <Text className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {t('scorers.addScorer')}
        </Text>
      </Pressable>
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
