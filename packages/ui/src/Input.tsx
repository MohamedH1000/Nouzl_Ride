import React from 'react';
import { View, type TextInputProps } from 'react-native';
import { Text, TextInput } from './Typography';
import { useTranslation } from 'react-i18next';
import { color, continuousCorner } from '@nouzl/theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
}

/** Plain TextInput styled with NativeWind classes against the shared
 *  tokens — @expo/ui has no equivalent bare text field (its FieldGroup is
 *  for grouped form SECTIONS, not a standalone labelled input), so a
 *  custom component is the right call here, unlike Button (see its
 *  docblock). */
export function Input({ label, error, style, accessibilityLabel, ...rest }: InputProps) {
  // Deliberately NOT I18nManager.isRTL/getConstants() here — live device
  // testing showed both can report false even while the native view tree
  // is genuinely laid out RTL (a JS/native desync that shows up specifically
  // after expo-updates' reloadAsync() inside Expo Go, which appears to swap
  // the JS bundle without re-initializing the native I18nManager bridge
  // module — Yoga's OWN mirroring of flex-row/start/end keeps working off
  // whatever direction the root native view already has, but a fresh JS
  // read of the bridge constant comes back stale). i18next's `language` is
  // the one piece of RTL-adjacent state this app updates and reads
  // consistently — every screen's Arabic/English copy already depends on
  // it — so basing this on it too avoids the desync entirely instead of
  // trying to out-guess the native module's cache.
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <View className="gap-1">
      {label ? <Text className="text-sm font-semibold text-text-secondary">{label}</Text> : null}
      <TextInput
        placeholderTextColor={color.neutral.textMuted}
        className="rounded-row border border-divider bg-card px-4 py-3 text-base text-text"
        // Set via `style`, not a `text-start` Tailwind class — Tailwind's
        // core plugin has no `text-start`/`text-end` text-align utility (it
        // only has the physical `text-left`/`text-right`), so that class
        // was silently a no-op the first time this was attempted. RN's own
        // `textAlign: 'auto'` default guesses direction from the VALUE's
        // own script, so a Latin value (an email address, say) sat
        // left-aligned inside an otherwise right-aligned Arabic form even
        // with the app genuinely in RTL. Forcing the real edge here makes
        // every field open on the same side as its label, regardless of
        // what's typed into it. `style` (an array) wins over `className`
        // in NativeWind's cascade, and the caller's own `style` prop —
        // spread after this object below — still wins over both.
        // Direction as well as alignment: right-aligned but LTR text put an
        // Arabic placeholder's "..." and a sentence's final "؟" on the wrong end.
        // A caller's own style (e.g. LTR for numbers, emails) still wins.
        style={[continuousCorner, { textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }, style]}
        // React Native has no implicit <label for> association the way
        // HTML does — a visible Text sibling above this field means
        // nothing to a screen reader unless explicitly wired through here.
        // Respects an explicit override if the caller already passes one.
        accessibilityLabel={accessibilityLabel ?? label}
        // React Native has no ARIA-style "invalid" state to set — a hint is
        // the closest a screen reader gets to hearing the error message.
        {...(error ? { accessibilityHint: error } : null)}
        {...rest}
      />
      {error ? <Text className="text-xs text-danger">{error}</Text> : null}
    </View>
  );
}
