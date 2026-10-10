import React from 'react';
import { FadeIn, FadeInDown, type AnimatedProps } from 'react-native-reanimated';
import { AnimatedView } from './interop';
import { type ViewProps } from 'react-native';
import { motion } from '@nouzl/theme';

/**
 * Entrance animation primitives. Both apps previously rendered every screen
 * as a hard cut — content simply appeared the frame the query resolved,
 * which reads as a flicker on a list that loads in under ~100ms and as a
 * jarring pop on one that takes longer.
 *
 * Built on Reanimated's LAYOUT animations (`entering`) rather than a manual
 * shared value + effect: they run entirely on the UI thread, need no state,
 * and cost nothing on unmount. Durations come from `@nouzl/theme`'s motion
 * tokens so screen transitions and press feedback stay on one timing scale.
 */

export interface EnterProps extends Omit<AnimatedProps<ViewProps>, 'className'> {
  className?: string;
  /** Position in a list — staggers the entrance so rows cascade instead of
   *  all arriving at once. Capped so a long list never delays visibly. */
  index?: number;
  /** Extra delay on top of the index stagger, in ms. */
  delay?: number;
  children?: React.ReactNode;
}

/** Per-item stagger step. 45ms reads as "a cascade" without the last row of
 *  a 10-item list waiting half a second. */
const STAGGER_MS = 45;
const MAX_STAGGER_STEPS = 8;

function staggerDelay(index = 0, delay = 0): number {
  return Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS + delay;
}

/** Fades and lifts content into place — the default for list rows and cards. */
export function EnterUp({ index, delay, children, ...rest }: EnterProps) {
  return (
    <AnimatedView
      entering={FadeInDown.duration(motion.duration.base).delay(staggerDelay(index, delay)).springify().damping(18)}
      {...rest}
    >
      {children}
    </AnimatedView>
  );
}

/** Plain cross-fade — for content that shouldn't appear to move, e.g. a
 *  header swapping between a skeleton and its real value. */
export function Enter({ index, delay, children, ...rest }: EnterProps) {
  return (
    <AnimatedView entering={FadeIn.duration(motion.duration.base).delay(staggerDelay(index, delay))} {...rest}>
      {children}
    </AnimatedView>
  );
}
