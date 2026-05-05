import { Text, View } from 'react-native';

import { useTranslation } from '@/i18n/useTranslation';

export default function BracketRoute() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-base text-slate-500 dark:text-slate-400">
        {t('tournament.comingSoon')}
      </Text>
    </View>
  );
}
