import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { detectInitialLocale, setAppLocale, type AppLocale } from '@/i18n';

export type ThemePreference = 'light' | 'dark' | 'system';

interface SettingsState {
  locale: AppLocale;
  theme: ThemePreference;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      locale: detectInitialLocale(),
      theme: 'system',
      setLocale: (locale) => {
        setAppLocale(locale);
        set({ locale });
      },
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'meu-torneio:settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ locale: state.locale, theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state?.locale) {
          setAppLocale(state.locale);
        }
      },
    }
  )
);
