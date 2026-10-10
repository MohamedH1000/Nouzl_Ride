import { useTranslation } from 'react-i18next';

/**
 * Reverses `items` when the app is running RTL — for a `flex-row
 * flex-wrap` chip/tag list specifically, NOT for a plain single-line
 * `flex-row`.
 *
 * A plain (non-wrapping) `flex-row` mirrors correctly on its own once the
 * app is genuinely RTL — Yoga reverses the main axis and nothing else is
 * needed. A WRAPPING row does not get the same treatment reliably on
 * Android in this RN/Yoga version: verified live (a multi-row amenity chip
 * list) that array item 1 still lands in the top-left slot of the first
 * line under RTL, while a same-screen non-wrapping row of the exact same
 * shape (two badges) DOES correctly show item 1 on the right. Rather than
 * trust flex-wrap's RTL behavior file by file, reverse the DATA once here
 * for any chip/tag list built from `.map()` over an array, and let plain
 * (non-wrapping) rows keep relying on Yoga's own mirroring.
 *
 * Deliberately keyed off `i18n.language`, NOT `I18nManager.isRTL` — live
 * device testing found the latter can report `false` (even via a fresh
 * `getConstants()` call) while the native view tree is genuinely laid out
 * RTL, specifically after expo-updates' `reloadAsync()` inside Expo Go.
 * See Input.tsx's docblock for the full explanation. i18next's `language`
 * is the one piece of this app's RTL-adjacent state that stays reliably in
 * sync, so every direction decision in `@nouzl/ui` now reads that instead.
 */
export function useRtlOrder<T>(items: readonly T[]): T[] {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  return isRtl ? [...items].reverse() : [...items];
}
