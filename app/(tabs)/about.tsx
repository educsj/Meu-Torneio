import { Linking, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { ExternalLink } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useTranslation } from '@/i18n/useTranslation';

const REPO_URL = 'https://github.com/educsj/Meu-Torneio';

export default function AboutScreen() {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <Screen scroll>
      <View className="pb-4 pt-6">
        <Text className="text-3xl font-bold text-slate-900 dark:text-white">
          {t('about.title')}
        </Text>
      </View>

      <Card className="mb-4">
        <Text className="text-xl font-bold text-slate-900 dark:text-white">
          {t('app.name')}
        </Text>
        <Text className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('app.tagline')}
        </Text>
        <Text className="mt-3 text-xs text-slate-500 dark:text-slate-500">
          {t('about.version')} {version}
        </Text>
      </Card>

      <Card className="mb-4">
        <Text className="text-base text-slate-700 dark:text-slate-300">
          {t('about.description')}
        </Text>
      </Card>

      <Card className="mb-4">
        <Text className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('about.developer')}
        </Text>
        <Text className="mt-1 text-base font-medium text-slate-900 dark:text-white">
          @educsj
        </Text>
        <Text className="mt-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('about.license')}
        </Text>
        <Text className="mt-1 text-base font-medium text-slate-900 dark:text-white">
          MIT
        </Text>
      </Card>

      <Button
        label={t('about.repository')}
        variant="secondary"
        onPress={() => Linking.openURL(REPO_URL)}
        leading={<ExternalLink size={18} color="#0f172a" />}
      />
    </Screen>
  );
}
