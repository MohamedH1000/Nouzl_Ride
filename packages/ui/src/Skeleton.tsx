import React, { useEffect } from 'react';
import { View, type ViewProps } from 'react-native';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedView } from './interop';
import { color, radius, shadow } from '@nouzl/theme';

/**
 * Shimmering placeholder blocks, shown while a screen's data loads.
 *
 * Replaces the bare centred `<ActivityIndicator>` every screen in both apps
 * used: a spinner tells the guest "something is happening somewhere",
 * whereas a skeleton in the shape of the incoming content tells them what
 * is about to arrive and keeps the layout from jumping when it does.
 *
 * The pulse is a single opacity loop on the UI thread — deliberately not a
 * translating gradient sweep, which needs an extra masked layer per block
 * and costs real frames on the low-end Android hardware partners actually
 * use at a reception desk.
 */
export interface SkeletonProps extends ViewProps {
  className?: string;
  /** Height in px. Width comes from the className (e.g. `w-24`, `w-full`). */
  height?: number;
  /** Corner radius; defaults to the theme's row radius. */
  rounded?: number;
}

export function Skeleton({ className, height = 14, rounded = radius.chip, style, ...rest }: SkeletonProps) {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <AnimatedView
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={className}
      style={[{ height, borderRadius: rounded, backgroundColor: color.neutral.divider }, animatedStyle, style]}
      {...rest}
    />
  );
}

/** A card-shaped skeleton — the loading stand-in for one list row. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <View className="gap-3 rounded-card bg-card p-4" style={shadow(1)}>
      <Skeleton className="w-1/2" height={16} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'w-2/3' : 'w-full'} height={11} />
      ))}
    </View>
  );
}

/** A full list of skeleton cards — the standard screen-level loading state. */
export function SkeletonList({ count = 4, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <View className="gap-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}
