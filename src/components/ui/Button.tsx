import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  leading?: ReactNode;
}

const styles: Record<Variant, { container: string; text: string }> = {
  primary: {
    container: 'bg-brand-600 active:bg-brand-700',
    text: 'text-white',
  },
  secondary: {
    container:
      'bg-slate-100 active:bg-slate-200 dark:bg-slate-800 dark:active:bg-slate-700',
    text: 'text-slate-900 dark:text-slate-100',
  },
  ghost: {
    container: 'bg-transparent active:bg-slate-100 dark:active:bg-slate-800',
    text: 'text-brand-600 dark:text-brand-300',
  },
  danger: {
    container: 'bg-red-600 active:bg-red-700',
    text: 'text-white',
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  leading,
}: ButtonProps) {
  const v = styles[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-center rounded-2xl px-5 py-3.5 ${v.container} ${disabled ? 'opacity-50' : ''}`}
    >
      {leading ? <View className="mr-2">{leading}</View> : null}
      <Text className={`text-base font-semibold ${v.text}`}>{label}</Text>
    </Pressable>
  );
}
