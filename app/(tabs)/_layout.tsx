import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { BarChart3, Info, Settings, Trophy } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

import { useTranslation } from '@/i18n/useTranslation';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: isDark ? '#8ed3ff' : '#1a78f5',
      tabBarInactiveTintColor: isDark ? '#64748b' : '#94a3b8',
      tabBarStyle: {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
      },
    }),
    [isDark]
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.tournaments'),
          tabBarIcon: ({ color, size }) => (
            <Trophy color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: t('tabs.statistics'),
          tabBarIcon: ({ color, size }) => (
            <BarChart3 color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: t('tabs.about'),
          tabBarIcon: ({ color, size }) => <Info color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
