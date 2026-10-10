import React from 'react';
import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';
import { Text } from './Typography';
import * as Haptics from 'expo-haptics';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AnimatedPressable } from './interop';
import { color, radius, motion } from '@nouzl/theme';


/**
 * A custom Pressable-based button rather than @expo/ui's native Button.
 * `expo-ui`'s component selection rule says check @expo/ui first for
 * generic controls (sheets, pickers, sliders, menus) — but a primary CTA
 * needs Nouzl's exact brand purple, radius and elevation, and @expo/ui's
 * Button deliberately renders as the platform's own control style rather
 * than accepting arbitrary brand colors. This is the one place custom wins;
 * @expo/ui is still the right default everywhere else in packages/ui.
 *
 * Press feedback is a real spring-driven scale (Reanimated), not just an
 * opacity swap — the tiny bit of "give" on press-in and "bounce back" on
 * release is what makes a button feel physically pressed rather than just
 * re-colored. iOS additionally gets a light haptic tap, matching
 * expo-native-ui's guidance to use expo-haptics for delight on iOS.
 */
export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, variant = 'primary', loading, disabled, style, onPressIn, onPressOut, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const backgroundColor =
    variant === 'primary' ? color.brand.DEFAULT : variant === 'secondary' ? color.brand.tint : 'transparent';
  const textColor = variant === 'primary' ? color.neutral.onBrand : color.brand.DEFAULT;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPressIn={(e: any) => {
        scale.value = withSpring(0.96, { damping: motion.easeSpring.damping, stiffness: motion.easeSpring.stiffness });
        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPressIn?.(e);
      }}
      onPressOut={(e: any) => {
        scale.value = withSpring(1, { damping: motion.easeSpring.damping, stiffness: motion.easeSpring.stiffness });
        onPressOut?.(e);
      }}
      style={[
        {
          backgroundColor,
          borderRadius: radius.row,
          paddingVertical: 12,
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? 0.5 : 1,
        },
        animatedStyle,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        // `font-bold` as a CLASS, not `style={{ fontWeight: '700' }}`:
        // Cairo ships as separate static TTFs, so a font-weight alone can
        // never bold it — RN has no heavier face to synthesize from. Only
        // global.css's `.font-bold` rule (which swaps the family to
        // Cairo_700Bold) actually produces a bold label. Every CTA in both
        // apps rendered at regular weight before this.
        <Text className="font-bold" style={{ color: textColor, fontSize: 15 }}>
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}
