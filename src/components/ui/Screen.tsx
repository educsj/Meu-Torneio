import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
}

export function Screen({ children, scroll = false }: ScreenProps) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView
      edges={['top']}
      className="flex-1 bg-white dark:bg-slate-950"
    >
      <Body
        className="flex-1 px-5"
        contentContainerClassName={scroll ? 'pb-10' : undefined}
      >
        {children}
      </Body>
    </SafeAreaView>
  );
}
