import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { BRAND_RGB } from '@nouzl/theme';

/**
 * A Pressable that actually acknowledges the tap.
 *
 * THE PROBLEM: 35 Pressables across the two apps had no press feedback of
 * any kind — no ripple, no opacity, no scale. A bare `<Pressable>` renders
 * nothing on press by itself. On Android that means tapping a chip, a
 * settings row or a text link produced *zero* response until the next
 * screen finished loading, which on a slow network reads as a dead
 * control and invites a second tap. (`Card`'s pressable variant already
 * solved this for card surfaces; everything smaller was left out.)
 *
 * WHAT IT DOES:
 *  - Android gets a real Material ripple, brand-tinted rather than the
 *    default grey so it belongs to this app.
 *  - iOS has no ripple primitive, so it gets the platform-idiomatic
 *    opacity dip instead, driven by onPressIn/onPressOut state (see the
 *    body for why it is not Pressable's style function) — `android_ripple`
 *    alone covers only one of the two platforms.
 *
 * Use `PressableCard` instead for anything that is an elevated card: a
 * bounded ripple needs `overflow: 'hidden'` to stay inside rounded corners,
 * and that same clip would eat the card's shadow.
 */
export interface TouchableProps extends PressableProps {
  className?: string;
  /**
   * `bounded` — ripple clipped to the control (chips, rows, filled
   * buttons). `borderless` — ripple radiating past it, for a bare text
   * link or icon with no background of its own to contain it. `none` —
   * opacity only, for a control that supplies its own animation.
   */
  ripple?: 'bounded' | 'borderless' | 'none';
}

/** Brand at low alpha: visible on both the white card and the tinted page. */
const RIPPLE_COLOR = `rgba(${BRAND_RGB}, 0.12)`;

export function Touchable({ ripple = 'bounded', style, disabled, onPressIn, onPressOut, ...rest }: TouchableProps) {
  // Pressed state is tracked here and the style passed as a plain ARRAY — not
  // as Pressable's style function. NativeWind's interop (web) replaces a
  // function style outright when a `className` is present, so every
  // Touchable with both lost its whole style: a caller's width/radius/opacity,
  // the clip below and the press dip (the add-photo tile collapsed to a sliver).
  const [pressed, setPressed] = React.useState(false);
  const ios = process.env.EXPO_OS === 'ios';
  const androidRipple =
    ripple === 'none' || disabled
      ? undefined
      : { color: RIPPLE_COLOR, borderless: ripple === 'borderless', foreground: ripple === 'bounded' };

  // A caller's own style function still receives the pressed state.
  const base = typeof style === 'function' ? style({ pressed } as Parameters<typeof style>[0]) : style;
  // iOS only: on Android the ripple IS the feedback, and dimming the
  // whole control on top of it double-signals the press.
  const pressedOpacity = pressed && ios && !disabled ? { opacity: 0.6 } : null;
  // `foreground: true` above draws the ripple over the content, which is
  // what keeps it visible on a filled background — but it still needs the
  // view to clip, or it squares off the rounded corners.
  const clip: ViewStyle | null = ripple === 'bounded' ? { overflow: 'hidden' } : null;

  return (
    <Pressable
      disabled={disabled}
      android_ripple={androidRipple}
      onPressIn={(e) => {
        if (ios) setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (ios) setPressed(false);
        onPressOut?.(e);
      }}
      style={[clip, pressedOpacity, base] as StyleProp<ViewStyle>}
      {...rest}
    />
  );
}
