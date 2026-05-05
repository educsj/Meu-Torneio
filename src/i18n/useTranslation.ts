import { useCallback } from 'react';

import { useSettingsStore } from '@/stores/useSettingsStore';

import { i18n, type AppLocale } from './index';

export function useTranslation() {
  const locale = useSettingsStore((s) => s.locale);

  const t = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      i18n.t(key, { locale, ...options }),
    [locale]
  );

  return { t, locale: locale as AppLocale };
}
