import { Component, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <View className="flex-1 items-center justify-center bg-white p-6 dark:bg-slate-950">
          <Text className="mb-2 text-center text-xl font-bold text-red-600">
            Algo quebrou
          </Text>
          <Text className="mb-4 text-center text-sm text-slate-600 dark:text-slate-400">
            {error.message}
          </Text>
          <Pressable
            onPress={this.reset}
            className="rounded-2xl bg-brand-600 px-5 py-3 active:bg-brand-700"
          >
            <Text className="font-semibold text-white">Tentar de novo</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
