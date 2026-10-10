import React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AnimatedPressable } from './interop';
import { continuousCorner, motion, shadow } from '@nouzl/theme';


/**
 * The surface both apps had copy-pasted inline on essentially every screen
 * (`className="rounded-card bg-card p-4" style={shadow(2)}`), plus a local
 * re-declaration inside reservation/[id].tsx. One definition means one place
 * to tune elevation and radius, and one place that keeps iOS and Android
 * shadows in step (a bare `elevation` is Android-only — see the `shadow()`
 * token's docblock).
 */
export interface CardProps extends ViewProps {
  className?: string;
  /** Elevation step from the theme's 4-level scale. */
  level?: 1 | 2 | 3 | 4;
  /** Drops the default padding for media-forward cards that bleed to the edge. */
  bare?: boolean;
}

export function Card({ className, level = 2, bare, style, children, ...rest }: CardProps) {
  return (
    <View
      className={`rounded-card bg-card ${bare ? '' : 'gap-3 p-4'} ${className ?? ''}`}
      style={[continuousCorner, shadow(level), style]}
      {...rest}
    >
      {children}
    </View>
  );
}

export interface PressableCardProps extends Omit<PressableProps, 'children'> {
  className?: string;
  level?: 1 | 2 | 3 | 4;
  bare?: boolean;
  children?: React.ReactNode;
}

/**
 * A Card that is also a tap target, with the same spring-driven press
 * feedback Button uses — a real physical "give" rather than an opacity
 * blink. Every tappable row/card in the business app was a plain Pressable
 * with no feedback at all before this.
 */
export function PressableCard({ className, level = 2, bare, style, onPressIn, onPressOut, children, ...rest }: PressableCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      className={`rounded-card bg-card ${bare ? '' : 'gap-3 p-4'} ${className ?? ''}`}
      onPressIn={(e) => {
        scale.value = withSpring(0.975, motion.easeSpring);
        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, motion.easeSpring);
        onPressOut?.(e);
      }}
      style={[continuousCorner, shadow(level), animatedStyle, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
