import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/useTranslation';
import {
  DEFAULT_PARTICIPANT_COLOR,
  PARTICIPANT_COLORS,
  PARTICIPANT_ICONS,
  getIconById,
} from '@/utils/icons';

import { ParticipantBadge } from './ParticipantBadge';

interface Props {
  visible: boolean;
  /** Header label — e.g. participant name when editing, generic when adding. */
  title: string;
  initialIcon: string | null;
  initialColor: string | null;
  onClose: () => void;
  /** Pass `null` for both to clear the badge (back to initials). */
  onSave: (icon: string | null, color: string | null) => void;
}

export function ParticipantBadgePicker({
  visible,
  title,
  initialIcon,
  initialColor,
  onClose,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [icon, setIcon] = useState<string | null>(initialIcon);
  const [color, setColor] = useState<string | null>(
    initialColor ?? DEFAULT_PARTICIPANT_COLOR
  );

  // Reset local state whenever the picker opens for a (potentially) new
  // target participant.
  useEffect(() => {
    if (visible) {
      setIcon(initialIcon);
      setColor(initialColor ?? DEFAULT_PARTICIPANT_COLOR);
    }
  }, [visible, initialIcon, initialColor]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl bg-white p-5 dark:bg-slate-900">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              className="rounded-full p-1.5 active:bg-slate-100 dark:active:bg-slate-800"
            >
              <X size={20} color="#94a3b8" />
            </Pressable>
          </View>

          <View className="mb-5 items-center">
            <ParticipantBadge
              icon={icon}
              iconColor={color}
              name={title}
              size={64}
            />
          </View>

          <Text className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('badgePicker.icon')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            <Pressable
              onPress={() => setIcon(null)}
              className={`mr-2 h-12 w-12 items-center justify-center rounded-2xl border ${
                icon == null
                  ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  icon == null
                    ? 'text-brand-700 dark:text-brand-200'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t('badgePicker.none')}
              </Text>
            </Pressable>
            {PARTICIPANT_ICONS.map(({ id, Icon }) => {
              const selected = id === icon;
              return (
                <Pressable
                  key={id}
                  onPress={() => setIcon(id)}
                  className={`mr-2 h-12 w-12 items-center justify-center rounded-2xl border ${
                    selected
                      ? 'border-brand-500 dark:border-brand-400'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                  style={{
                    backgroundColor: selected
                      ? color ?? DEFAULT_PARTICIPANT_COLOR
                      : 'transparent',
                  }}
                >
                  <Icon
                    size={22}
                    color={selected ? '#ffffff' : '#64748b'}
                    strokeWidth={2.2}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          <Text className="mb-2 mt-4 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('badgePicker.color')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {PARTICIPANT_COLORS.map((c) => {
              const selected = c === color;
              return (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  className="items-center justify-center"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: c,
                    borderWidth: selected ? 3 : 0,
                    borderColor: '#ffffff',
                  }}
                >
                  {selected ? (
                    <Check size={18} color="#ffffff" strokeWidth={3} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View className="mt-6 flex-row gap-2">
            <View className="flex-1">
              <Button
                variant="ghost"
                label={t('badgePicker.clear')}
                onPress={() => {
                  setIcon(null);
                  setColor(DEFAULT_PARTICIPANT_COLOR);
                  onSave(null, null);
                }}
              />
            </View>
            <View className="flex-1">
              <Button
                label={t('common.save')}
                onPress={() => onSave(icon, icon ? color : null)}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Convenience for callers that just want to render a small preview. */
export function previewIcon(id: string | null) {
  return getIconById(id);
}
