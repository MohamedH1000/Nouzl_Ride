import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { color } from '@nouzl/theme';
import { BrandDots, BrandMark, brandDiscColor, type BrandTone } from './Brand';

/** Must equal `imageWidth` of expo-splash-screen in both app.json files. */
export const NATIVE_SPLASH_MARK_SIZE = 120;

/**
 * The JS splash that takes over from the native launch image.
 *
 * It STARTS as an exact copy of that image — the round mark, 120pt, centred
 * on the page colour, fully opaque, no entrance animation — so the hand-off
 * is invisible. (The previous splash faded in the wide logo lockup, so the
 * user saw one logo, a flash of empty page, then a different logo.)
 *
 * While fonts / language / session resolve it breathes gently; if that takes
 * more than a moment the brand dots appear so it never looks frozen. When
 * `ready` flips it lifts slightly and fades, and only then calls `onFinish`.
 */
export function BrandSplash({ ready, onFinish, tone = 'customer' }: { ready: boolean; onFinish: () => void; tone?: BrandTone }) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const breathe = useSharedValue(1);
  const dots = useSharedValue(0);

  useEffect(() => {
    breathe.value = withDelay(
      250,
      withRepeat(
        withSequence(
          withTiming(1.035, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    dots.value = withDelay(900, withTiming(1, { duration: 300 }));
  }, [breathe, dots]);

  // The exit must start ONCE. Callers pass an inline `onFinish`, so keeping it
  // in the effect's deps re-ran the effect on every parent render — and each
  // re-run restarted the delayed fade, leaving the splash stuck on screen.
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);
  const exiting = useRef(false);
  const finish = useCallback(() => onFinishRef.current(), []);

  useEffect(() => {
    if (!ready || exiting.current) return;
    exiting.current = true;
    cancelAnimation(breathe);
    cancelAnimation(dots);
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design
    dots.value = withTiming(0, { duration: 120 });
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(1.08, { duration: 340, easing: Easing.in(Easing.cubic) });
    // eslint-disable-next-line react-hooks/immutability
    opacity.value = withDelay(
      60,
      withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(finish)();
      }),
    );
  }, [ready, finish, breathe, dots, opacity, scale]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value * breathe.value }] }));
  const dotsStyle = useAnimatedStyle(() => ({ opacity: dots.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, { pointerEvents: 'none' }, containerStyle]}>
      <Animated.View style={markStyle}>
        <BrandMark size={NATIVE_SPLASH_MARK_SIZE} tone={tone} />
      </Animated.View>
      {/* Absolutely placed below the mark so it never nudges the mark off the
          native image's exact centre. */}
      <Animated.View style={[styles.dots, dotsStyle]}>
        <View>
          <BrandDots tint={brandDiscColor(tone)} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: color.neutral.page,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  dots: {
    position: 'absolute',
    top: '50%',
    marginTop: NATIVE_SPLASH_MARK_SIZE / 2 + 36,
    alignSelf: 'center',
  },
});
