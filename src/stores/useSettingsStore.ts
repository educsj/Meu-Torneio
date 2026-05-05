import { create } from 'zustand';

import { detectInitialLocale, setAppLocale, type AppLocale } from '@/i18n';

export type ThemePreference = 'light' | 'dark' | 'system';

interface SettingsState {
  locale: AppLocale;
  theme: ThemePreference;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  locale: detectInitialLocale(),
  theme: 'system',
  setLocale: (locale) => {
    setAppLocale(locale);
    set({ locale });
  },
  setTheme: (theme) => set({ theme }),
}));
