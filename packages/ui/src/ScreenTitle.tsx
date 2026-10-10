import React from 'react';
import { View } from 'react-native';
import { Text } from './Typography';

/**
 * The in-body heading at the top of a screen.
 *
 * TWO PROBLEMS THIS SOLVES.
 *
 * 1. Geometry drift. The same element was written six different ways across
 *    the two apps — `px-4 pb-2 pt-3`, `px-5 pb-2 pt-3`, `px-1` inside a
 *    `p-4` scroll container, and three with no padding of their own at all
 *    because a parent happened to supply it. Landing on 16pt on one screen
 *    and 20pt on the next is visible when you swipe between tabs, and none
 *    of it was deliberate.
 *
 * 2. No heading semantics. There was not one `accessibilityRole="header"`
 *    anywhere in either app, so TalkBack and VoiceOver announced every
 *    screen title as ordinary text. Screen-reader users navigate by
 *    heading; without the role there is nothing to jump to, and the rotor's
 *    "Headings" mode finds an empty list on every screen.
 *
 * What it deliberately does NOT unify is the type treatment. The customer
 * app's `text-2xl text-brand` and the business app's `text-xl text-text`
 * each mirror their own web counterpart — `Nouzl_Platform` heads its pages
 * with a 2xl, `nouzl_business` with `<h2 class="text-xl font-extrabold
 * text-text">`. That difference is the design, not drift, so it stays a
 * per-call choice via `tone`/`size` rather than being flattened here.
 */
export interface ScreenTitleProps {
  title: string;
  /** Optional supporting line beneath the title. */
  subtitle?: string;
  /** Trailing slot — an icon button, a filter chip, a count. */
  action?: React.ReactNode;
  /** `brand` for the customer app, `default` for the business console. */
  tone?: 'brand' | 'default';
  size?: 'xl' | '2xl';
  /**
   * `screen` for a title that is a direct child of the screen container and
   * therefore owns its own inset. `none` for one already inside a padded
   * scroll container, where the parent's padding and gap are the spacing —
   * adding any here double-applies it, which is how the same heading ended
   * up 12pt lower on some screens than others.
   */
  padding?: 'screen' | 'none';
  className?: string;
}

export function ScreenTitle({
  title,
  subtitle,
  action,
  tone = 'brand',
  size = '2xl',
  padding = 'screen',
  className,
}: ScreenTitleProps) {
  const toneClass = tone === 'brand' ? 'text-brand' : 'text-text';
  const sizeClass = size === '2xl' ? 'text-2xl' : 'text-xl';
  const padClass = padding === 'screen' ? 'px-4 pb-2 pt-3' : '';

  return (
    <View className={`flex-row items-center justify-between gap-3 ${padClass} ${className ?? ''}`}>
      <View className="flex-1 gap-0.5">
        {/* accessibilityRole="header" is the whole point of routing titles
            through here — see the docblock. */}
        <Text accessibilityRole="header" className={`${sizeClass} font-extrabold ${toneClass}`}>
          {title}
        </Text>
        {subtitle ? <Text className="text-sm text-text-secondary">{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
