import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { Text } from './Typography';

/**
 * A selectable pill. This exact shape was hand-rolled at least eight times
 * across the two apps — room, duration and arrival pickers plus gender, ID
 * type and payment method on the booking screen, the calendar's property
 * and room pickers, the employee role picker, the currency picker — and
 * almost every copy was a bare `<Text onPress>`.
 *
 * That is wrong twice over. A screen reader announces `<Text>` as static
 * content, so a blind guest could not tell those pills were choosable at
 * all; and a text node's padding gave a tap target well under the 44pt
 * minimum Apple's HIG asks for. Rendering a real `Pressable` with
 * `accessibilityRole="button"` and `accessibilityState={{ selected }}`
 * fixes the announcement, and the min-height plus hitSlop below fix the
 * target.
 */
export interface ChipProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  selected?: boolean;
  /** Filled brand background when selected (pickers) vs. a tinted outline
   *  (filters). Defaults to `solid`, the more common of the two here. */
  variant?: 'solid' | 'outline';
}

export function Chip({ label, selected = false, variant = 'solid', disabled, ...rest }: ChipProps) {
  const base = 'items-center justify-center rounded-chip px-3.5';

  const skin =
    variant === 'outline'
      ? selected
        ? 'border border-brand bg-brand-tint'
        : 'border border-divider bg-card'
      : selected
        ? 'bg-brand'
        : 'bg-card';

  const textSkin =
    variant === 'outline'
      ? selected
        ? 'text-brand font-bold'
        : 'text-text-secondary'
      : selected
        ? 'text-on-brand font-bold'
        : 'text-text-secondary font-semibold';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      // 40pt tall plus 6pt of slop on every side clears the 44pt target
      // without making a row of chips look chunky.
      hitSlop={6}
      style={{ minHeight: 40, opacity: disabled ? 0.5 : 1 }}
      className={`${base} ${skin}`}
      {...rest}
    >
      <Text className={`text-sm ${textSkin}`} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
