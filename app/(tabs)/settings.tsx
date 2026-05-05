import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SUPPORTED_LOCALES, type AppLocale } from '@/i18n';
import { useTranslation } from '@/i18n/useTranslation';
import {
  useSettingsStore,
  type ThemePreference,
} from '@/stores/useSettingsStore';

const LOCALE_LABEL: Record<AppLocale, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const locale = useSettingsStore((s) => s.locale);
  const theme = useSettingsStore((s) => s.theme);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <Screen scroll>
      <View className="pb-4 pt-6">
        <Text className="text-3xl font-bold text-slate-900 dark:text-white">
          {t('settings.title')}
        </Text>
      </View>

      <Section title={t('common.language')} subtitle={t('settings.languageDescription')}>
        <Card>
          {SUPPORTED_LOCALES.map((code, idx) => (
            <OptionRow
              key={code}
              label={LOCALE_LABEL[code]}
              selected={code === locale}
              onPress={() => setLocale(code)}
              isLast={idx === SUPPORTED_LOCALES.length - 1}
            />
          ))}
        </Card>
      </Section>

      <Section title={t('common.theme')} subtitle={t('settings.themeDescription')}>
        <Card>
          {(['system', 'light', 'dark'] as ThemePreference[]).map((opt, idx, arr) => (
            <OptionRow
              key={opt}
              label={t(
                opt === 'system'
                  ? 'common.themeSystem'
                  : opt === 'light'
                    ? 'common.themeLight'
                    : 'common.themeDark'
              )}
              selected={opt === theme}
              onPress={() => setTheme(opt)}
              isLast={idx === arr.length - 1}
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </Text>
      {subtitle ? (
        <Text className="mb-2 text-sm text-slate-600 dark:text-slate-400">
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function OptionRow({
  label,
  selected,
  onPress,
  isLast,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  isLast: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between py-3 ${
        isLast ? '' : 'border-b border-slate-100 dark:border-slate-800'
      }`}
    >
      <Text className="text-base text-slate-900 dark:text-slate-100">
        {label}
      </Text>
      {selected ? (
        <View className="h-3 w-3 rounded-full bg-brand-600" />
      ) : (
        <View className="h-3 w-3 rounded-full border border-slate-300 dark:border-slate-600" />
      )}
    </Pressable>
  );
}
