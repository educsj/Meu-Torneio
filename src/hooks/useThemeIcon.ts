import { useColorScheme } from 'nativewind';

export function useThemeIcon() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return {
    primary: isDark ? '#f1f5f9' : '#0f172a',
    secondary: isDark ? '#cbd5e1' : '#475569',
    muted: '#94a3b8',
  };
}
