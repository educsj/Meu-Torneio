import '../global.css';

import { useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';

import { getDatabase } from '@/db';
import { useSettingsStore } from '@/stores/useSettingsStore';

export default function RootLayout() {
  const themePref = useSettingsStore((s) => s.theme);
  const systemScheme = useColorScheme();
  const effective =
    themePref === 'system' ? (systemScheme ?? 'light') : themePref;

  useEffect(() => {
    getDatabase().catch((err) => {
      console.error('Failed to open database', err);
    });
  }, []);

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: {
        backgroundColor: effective === 'dark' ? '#020617' : '#ffffff',
      },
    }),
    [effective]
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={effective === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={screenOptions} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
