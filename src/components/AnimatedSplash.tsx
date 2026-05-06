import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Trophy } from 'lucide-react-native';

import { useTranslation } from '@/i18n/useTranslation';

const BRAND_BLUE = '#1a78f5';
const GOLD = '#fbbf24';
const CONFETTI_COLORS = [
  '#fde68a',
  '#fbbf24',
  '#f59e0b',
  '#ffffff',
  '#bfdbfe',
  '#93c5fd',
];

interface Props {
  /** Called once the fade-out finishes so the parent can unmount us. */
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: Props) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const trophyScale = useSharedValue(0);
  const trophyOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslate = useSharedValue(20);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    // Trophy springs in first.
    trophyOpacity.value = withTiming(1, { duration: 200 });
    trophyScale.value = withSpring(1, { damping: 8, stiffness: 90 });
    // Title slides up + fades in shortly after.
    textOpacity.value = withDelay(450, withTiming(1, { duration: 400 }));
    textTranslate.value = withDelay(
      450,
      withSpring(0, { damping: 12, stiffness: 120 })
    );
    // Hold ~1.6s after the title lands, then fade the whole screen out.
    containerOpacity.value = withDelay(
      2300,
      withTiming(0, { duration: 400 }, (finished) => {
        if (finished) runOnJS(onFinish)();
      })
    );
    // We only run this once on mount — shared values capture their refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trophyStyle = useAnimatedStyle(() => ({
    opacity: trophyOpacity.value,
    transform: [{ scale: trophyScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslate.value }],
  }));
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View
      style={[styles.container, containerStyle]}
      pointerEvents="none"
    >
      <Animated.View style={trophyStyle}>
        <Trophy size={132} color={GOLD} fill={GOLD} strokeWidth={1.5} />
      </Animated.View>
      <Animated.Text style={[styles.title, textStyle]}>
        {t('splash.appName')}
      </Animated.Text>
      {/* Two cannons firing inward from each top corner — covers the screen
          symmetrically without requiring a single cannon to overshoot. */}
      <ConfettiCannon
        count={80}
        origin={{ x: -20, y: -10 }}
        explosionSpeed={420}
        fallSpeed={3200}
        fadeOut
        colors={CONFETTI_COLORS}
      />
      <ConfettiCannon
        count={80}
        origin={{ x: width + 20, y: -10 }}
        explosionSpeed={420}
        fallSpeed={3200}
        fadeOut
        colors={CONFETTI_COLORS}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 28,
    letterSpacing: 0.5,
  },
});
