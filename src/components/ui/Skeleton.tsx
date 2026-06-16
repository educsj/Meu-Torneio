import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

interface SkeletonProps {
  /** Tailwind classes for size/shape (e.g. "h-4 w-24 rounded-lg"). */
  className?: string;
}

/**
 * A single shimmering placeholder bar. Pulses its opacity between 0.5 and 1
 * so a screen can show structure while its data loads instead of flashing an
 * empty state. Compose several to mimic the shape of the real content.
 */
export function Skeleton({ className }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <View
        className={`rounded-xl bg-slate-200 dark:bg-slate-800 ${className ?? ''}`}
      />
    </Animated.View>
  );
}

/**
 * A vertical stack of card-shaped skeletons — the default placeholder for the
 * app's list screens (tournaments, matches, etc.).
 */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
        >
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-2.5 h-3 w-1/4" />
        </View>
      ))}
    </View>
  );
}
