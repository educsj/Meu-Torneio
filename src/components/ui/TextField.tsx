import { Text, TextInput, View } from 'react-native';

interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  autoFocus,
}: TextFieldProps) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoFocus={autoFocus}
        className={`rounded-xl border bg-white px-4 py-3 text-base text-slate-900 dark:bg-slate-900 dark:text-slate-100 ${
          error
            ? 'border-red-500'
            : 'border-slate-300 dark:border-slate-700'
        }`}
      />
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}
