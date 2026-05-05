import '../global.css';

import { useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { colorScheme, useColorScheme } from 'nativewind';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getDatabase } from '@/db';
import { useSettingsStore } from '@/stores/useSettingsStore';

enableScreens(false);

export default function RootLayout() {
  const themePref = useSettingsStore((s) => s.theme);
  const { colorScheme: active } = useColorScheme();
  const isDark = active === 'dark';

  useEffect(() => {
    colorScheme.set(themePref);
  }, [themePref]);

  useEffect(() => {
    getDatabase().catch((err) => {
      console.error('Failed to open database', err);
    });
  }, []);

  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: isDark ? '#020617' : '#ffffff',
        card: isDark ? '#0f172a' : '#ffffff',
        text: isDark ? '#f8fafc' : '#0f172a',
        border: isDark ? '#1e293b' : '#e2e8f0',
        primary: '#1a78f5',
      },
    };
  }, [isDark]);

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: {
        backgroundColor: isDark ? '#020617' : '#ffffff',
      },
    }),
    [isDark]
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ThemeProvider value={navTheme}>
          <ErrorBoundary>
            <Stack screenOptions={screenOptions} />
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
