import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color } from '@nouzl/theme';

/**
 * The little ">" at the end of a tappable row that says "this drills into
 * something else" — iOS Settings calls it a disclosure indicator. It has to
 * mirror in RTL: navigation flows start→end, and "end" is the LEFT edge in
 * Arabic, so a chevron that always points visually right (like a bare
 * `chevron-forward` does) points the wrong way for half of this app's
 * users.
 *
 * Keyed off `i18n.language`, NOT `I18nManager.isRTL` — despite this
 * component's original reasoning that the native flag was the more
 * "authoritative" source, live device testing found `I18nManager.isRTL`
 * (and even a fresh `I18nManager.getConstants().isRTL` bridge call) can
 * report `false` while the native view tree is genuinely laid out RTL,
 * specifically after expo-updates' `reloadAsync()` inside Expo Go — see
 * Input.tsx's docblock for the full explanation. i18next's `language` is
 * the one piece of this app's RTL-adjacent state that stays reliably in
 * sync, so every direction decision in `@nouzl/ui` now reads that instead.
 */
export function DisclosureChevron({ size = 18, tint }: { size?: number; tint?: string }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  return <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={size} color={tint ?? color.neutral.textMuted} />;
}
