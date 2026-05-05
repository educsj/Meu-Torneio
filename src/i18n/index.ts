import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';

import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';

export type AppLocale = 'pt-BR' | 'en';

export const SUPPORTED_LOCALES: AppLocale[] = ['pt-BR', 'en'];

export const i18n = new I18n(
  { 'pt-BR': ptBR, en },
  { defaultLocale: 'pt-BR', enableFallback: true }
);

i18n.locale = detectInitialLocale();

export function detectInitialLocale(): AppLocale {
  const device = getLocales()[0]?.languageTag ?? 'pt-BR';
  if (device.startsWith('pt')) return 'pt-BR';
  if (device.startsWith('en')) return 'en';
  return 'pt-BR';
}

export function setAppLocale(locale: AppLocale): void {
  i18n.locale = locale;
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}
