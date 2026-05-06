import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Download, Upload } from 'lucide-react-native';

import {
  exportTournamentJson,
  importTournamentJson,
} from '@/db/exportImport';
import { useTranslation } from '@/i18n/useTranslation';

interface ExportButtonProps {
  tournamentId: number;
}

export function ExportTournamentButton({ tournamentId }: ExportButtonProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const { filename, json } = await exportTournamentJson(tournamentId);
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, json);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          t('backup.exportTitle'),
          `${t('backup.savedTo')} ${path}`
        );
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: t('backup.shareDialog'),
        UTI: 'public.json',
      });
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={handleExport}
      disabled={busy}
      className={`flex-row items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800 ${
        busy ? 'opacity-50' : ''
      }`}
    >
      <Download size={16} color="#475569" />
      <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        {t('backup.export')}
      </Text>
    </Pressable>
  );
}

interface ImportButtonProps {
  onImported: (newTournamentId: number) => void;
}

export function ImportTournamentButton({ onImported }: ImportButtonProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleImport = async () => {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      const json = await FileSystem.readAsStringAsync(asset.uri);
      const newId = await importTournamentJson(json);
      onImported(newId);
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={handleImport}
      disabled={busy}
      className={`flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 active:bg-slate-50 dark:border-slate-700 dark:active:bg-slate-800 ${
        busy ? 'opacity-50' : ''
      }`}
    >
      <View>
        <Upload size={16} color="#475569" />
      </View>
      <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {t('backup.import')}
      </Text>
    </Pressable>
  );
}
