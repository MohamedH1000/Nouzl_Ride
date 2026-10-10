import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

/**
 * Forces the whole subtree's layout direction from the app language.
 *
 * THE BUG THIS FIXES: these apps had TWO sources of truth for direction and
 * they could disagree.
 *
 *  - LAYOUT mirroring (flex-row order, `start`/`end`, logical margins) is
 *    decided by Yoga from `I18nManager.isRTL` — a native flag cached at
 *    module init that only changes after a full reload.
 *  - Everything else — the disclosure chevron's direction
 *    (DisclosureChevron), wrapping chip order (useRtlOrder), text alignment
 *    (Typography) — reads `i18n.language`, deliberately, because live device
 *    testing found `I18nManager.isRTL` reporting `false` on a genuinely RTL
 *    tree after `Updates.reloadAsync()`.
 *
 * When those two disagree you get precisely the reported symptom: rows that
 * did not mirror while their icons and text alignment did, so an Arabic
 * screen shows the icon on one side and its label pushed to the other, and
 * arrows point the wrong way. It is not one broken screen — it is every
 * `flex-row` in the app, which is why it reads as "a lot of directions need
 * to be adjusted".
 *
 * Setting Yoga's own `direction` style here makes layout follow the SAME
 * `i18n.language` everything else already follows, so the two can no longer
 * drift. Yoga inherits `direction` down the tree (children default to
 * `inherit`), so one node at the root mirrors every descendant
 * deterministically — no reload, no native flag, no per-screen branching.
 *
 * Requires the New Architecture for Android, which Expo SDK 57 enables by
 * default. Native navigator chrome (the stack's own back chevron, tab bar)
 * still follows `I18nManager.isRTL`; `syncNativeDirectionAtBoot()` in
 * @nouzl/i18n remains responsible for that, and this provider is what makes
 * the app's OWN layout correct in the meantime.
 */
export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return <View style={{ flex: 1, direction: isRtl ? 'rtl' : 'ltr' }}>{children}</View>;
}
