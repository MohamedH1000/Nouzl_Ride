import React from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextProps as RNTextProps,
  type TextInputProps as RNTextInputProps,
  type TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

/**
 * App-wide themed `Text` / `TextInput`. EVERY screen in both apps imports
 * these instead of react-native's, and that is load-bearing for two things
 * the apps could not get any other way:
 *
 * 1. THE FONT. `@nouzl/theme`'s `applyDefaultFont()` used to set
 *    `Text.defaultProps.style = { fontFamily: 'Cairo_400Regular' }`, which
 *    is the classic RN recipe for "one font everywhere". It has never once
 *    worked here, and it cannot: React resolves `defaultProps` only in the
 *    LEGACY `React.createElement` path. Both apps compile JSX with the
 *    AUTOMATIC runtime (babel.config.js: `babel-preset-expo` with
 *    `jsxImportSource: 'nativewind'`), which emits `jsx(Text, props)` from
 *    `react/jsx-runtime` — and that path does not read `defaultProps` at
 *    all. Verified against the installed React 19.2.3:
 *      createElement(Fn).props.style -> { fontFamily: 'Cairo' }
 *      jsx(Fn, {}).props.style       -> undefined
 *    So the only text actually rendering in Cairo was text that happened to
 *    carry an explicit `font-*` class (those resolve through global.css's
 *    real CSS rules); everything styled only with `text-sm`/colour classes
 *    silently fell back to the OS font — Roboto on Android, SF on iOS.
 *
 * 2. THE DIRECTION. RN's default `textAlign: 'auto'` picks a side from the
 *    STRING'S OWN script, not the app's language, so an English/Latin value
 *    (an email, a price, a booking reference) left-aligns itself inside an
 *    otherwise right-aligned Arabic screen. Defaulting the alignment from
 *    `i18n.language` fixes that for every piece of text at once.
 *
 * WHY `font-normal` IS PREPENDED AS A CLASS rather than set via `style`:
 * NativeWind merges className-derived styles and the `style` prop with a
 * precedence that would make a style-based `fontFamily` beat a caller's
 * `font-bold` class — silently un-bolding every heading in both apps.
 * Prepending the class instead defers to plain CSS ordering, and
 * global.css deliberately declares `.font-normal` FIRST of the five font
 * rules, so any explicit weight a caller passes (`font-medium`,
 * `font-semibold`, `font-bold`, `font-extrabold`) is declared later and
 * wins. Do not reorder those rules in global.css.
 */

/** Matches an explicit Tailwind text-align utility in a className string. */
const EXPLICIT_ALIGN = /(?:^|\s)text-(left|center|right|justify|start|end)(?:\s|$)/;

function useDirectionalAlign(className: string | undefined, style: unknown): TextStyle | null {
  // Deliberately i18next's `language`, NOT `I18nManager.isRTL` — the latter
  // is cached at native module init and has been observed reporting `false`
  // on a genuinely RTL view tree after expo-updates' reloadAsync() inside
  // Expo Go. See rtlOrder.ts for the full account.
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  // An explicit alignment from the caller always wins — a centered empty
  // state or a right-aligned price column must not be dragged back to the
  // language's default edge.
  if (className && EXPLICIT_ALIGN.test(className)) return null;
  const flattened = StyleSheet.flatten(style as never) as TextStyle | undefined;
  if (flattened?.textAlign) return null;

  return isRtl ? RTL_TEXT : LTR_TEXT;
}

/**
 * The text's own direction, and NO physical textAlign (2026-10-08).
 *
 * `textAlign: 'right'` put Arabic on the LEFT on Android whenever the
 * surrounding layout was genuinely right-to-left (seen on the sign-in card,
 * while the home title looked right). React Native's Android text layout
 * (TextLayoutManager.getTextAlignment) treats "right" as ALIGN_OPPOSITE
 * when paragraph and script directions match, and for Arabic in an RTL
 * paragraph the opposite edge is the left. Which screens were affected
 * depended on how each subtree's direction resolved.
 *
 * Giving the text node its own `direction` makes its paragraph direction
 * known, and leaving alignment to the platform's natural (start) edge then
 * lands Arabic AND Latin values (emails, prices) on the right in Arabic and
 * on the left in English, on Android, iOS (via writingDirection) and web.
 */
const RTL_TEXT: TextStyle = { direction: 'rtl', writingDirection: 'rtl' };
const LTR_TEXT: TextStyle = { direction: 'ltr', writingDirection: 'ltr' };

/** Inputs keep a physical alignment: an empty field has no script to go by. */
function useInputAlign(className: string | undefined, style: unknown): TextStyle | null {
  const base = useDirectionalAlign(className, style);
  if (!base) return null;
  const isRtl = base === RTL_TEXT;
  return { textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' };
}

function withDefaultWeight(className: string | undefined): string {
  return className ? `font-normal ${className}` : 'font-normal';
}

export type TextProps = RNTextProps & { className?: string };

export function Text({ className, style, ...rest }: TextProps) {
  const align = useDirectionalAlign(className, style);
  return <RNText {...rest} className={withDefaultWeight(className)} style={align ? [align, style] : style} />;
}

export type TextInputProps = RNTextInputProps & { className?: string };

export function TextInput({ className, style, ...rest }: TextInputProps) {
  const align = useInputAlign(className, style);
  return <RNTextInput {...rest} className={withDefaultWeight(className)} style={align ? [align, style] : style} />;
}
