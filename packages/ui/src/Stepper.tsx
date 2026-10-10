import React from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color } from '@nouzl/theme';
import { Text } from './Typography';

/**
 * A −/value/+ counter. The booking screen previously spelled this out as
 * bare `<Text onPress>` glyphs with `px-2` padding — roughly a 20x24pt tap
 * target, well under the 44pt minimum, and announced by a screen reader as
 * the literal character "−" with no indication it did anything.
 *
 * The circular buttons here are 36pt with 6pt of hitSlop (44 effective),
 * carry a real role and label, and expose the bound they are at through
 * `accessibilityState.disabled` so the reader says "dimmed" instead of
 * silently doing nothing.
 */
export interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  /** Announced as the thing being counted, e.g. "Guests". */
  label: string;
  decrementLabel?: string;
  incrementLabel?: string;
}

export function Stepper({
  value,
  min = 0,
  max = 99,
  onChange,
  label,
  decrementLabel,
  incrementLabel,
}: StepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View className="flex-row items-center gap-3" accessibilityLabel={`${label}: ${value}`}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={atMin}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={decrementLabel ?? `${label} −`}
        accessibilityState={{ disabled: atMin }}
        className="items-center justify-center rounded-full border border-divider"
        style={{ height: 36, width: 36, opacity: atMin ? 0.4 : 1, borderCurve: 'continuous' }}
      >
        <Ionicons name="remove" size={18} color={color.neutral.text} />
      </Pressable>

      {/* tabular-nums so the row doesn't shift width as the count changes. */}
      <Text className="w-7 text-center text-base font-bold text-text" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>

      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={atMax}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={incrementLabel ?? `${label} +`}
        accessibilityState={{ disabled: atMax }}
        className="items-center justify-center rounded-full border border-divider"
        style={{ height: 36, width: 36, opacity: atMax ? 0.4 : 1, borderCurve: 'continuous' }}
      >
        <Ionicons name="add" size={18} color={color.neutral.text} />
      </Pressable>
    </View>
  );
}
