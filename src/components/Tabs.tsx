import { Pressable, Text, View } from 'react-native';

interface TabItem<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
}

export function Tabs<T extends string>({ items, value, onChange }: Props<T>) {
  return (
    <View className="flex-row rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            className={`flex-1 items-center justify-center rounded-xl px-3 py-2 ${
              selected ? 'bg-white shadow-sm dark:bg-slate-700' : ''
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                selected
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
