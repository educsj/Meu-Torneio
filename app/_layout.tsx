import '../global.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
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

import { AnimatedSplash } from '@/components/AnimatedSplash';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getDatabase } from '@/db';
import { useSettingsStore } from '@/stores/useSettingsStore';

enableScreens(false);

// Keep the static splash visible until our animated overlay takes over —
// otherwise the user sees a brief flash of the empty app between the two.
// `.catch` because preventAutoHide rejects if the splash has already auto-
// hidden, which is fine: we'd just skip the animation in that edge case.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const themePref = useSettingsStore((s) => s.theme);
  const { colorScheme: active } = useColorScheme();
  const isDark = active === 'dark';
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  useEffect(() => {
    colorScheme.set(themePref);
  }, [themePref]);

  useEffect(() => {
    getDatabase().catch((err) => {
      console.error('Failed to open database', err);
    });
  }, []);

  // Hide the static (PNG) splash as soon as the JS layout has rendered, so
  // the AnimatedSplash overlay can take over without a visible seam.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleSplashFinish = useCallback(() => {
    setShowAnimatedSplash(false);
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
        {showAnimatedSplash ? (
          <AnimatedSplash onFinish={handleSplashFinish} />
        ) : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
