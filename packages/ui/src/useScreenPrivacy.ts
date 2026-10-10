import { useCallback } from 'react';

import { useFocusEffect } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';

/**
 * "Blur the app switcher preview on wallet, ID card and financials
 * screens" — the one security-checklist item from the plan that had no
 * code at all. Call from any screen showing money, points balance, or a
 * scannable ID (the customer wallet, the digital ID card, the business
 * financials/payouts screens).
 *
 * Deliberately built on `preventScreenCaptureAsync`/`allowScreenCaptureAsync`
 * tied to `useFocusEffect`, NOT the `usePreventScreenCapture()` hook tied
 * to mount/unmount — verified live that the difference matters. These
 * screens live inside a bottom-tab navigator, which keeps inactive tabs
 * MOUNTED (just hidden) rather than unmounting them on tab switch. A
 * mount/unmount-scoped hook's cleanup never fires on a tab switch, so
 * Android's FLAG_SECURE (the mechanism behind both the screenshot block
 * and the automatic app-switcher blur — see the module's own docs) stayed
 * ON for the rest of the session after a single visit to Wallet: a real
 * screenshot taken via `adb screencap` while sitting on the unrelated
 * sign-in screen still came back solid black. `useFocusEffect`'s cleanup
 * runs on BLUR — the moment the user navigates away, even to a screen
 * reached from within this same still-mounted tab — which is the correct
 * lifecycle for a protection that should apply only while this specific
 * screen is the one actually on screen.
 *
 * On Android, `preventScreenCaptureAsync()` alone already blurs the
 * app-switcher/recents preview as a side effect of the FLAG_SECURE window
 * flag it sets — no separate call needed there. iOS needs one more call,
 * `enableAppSwitcherProtectionAsync()`, for that specific case, gated to
 * iOS explicitly per this codebase's existing `process.env.EXPO_OS === 'ios'`
 * convention (see `@nouzl/ui`'s `Button`) rather than trusting the native
 * module to no-op safely cross-platform on its own.
 *
 * `key` MUST be unique per call site (e.g. the route name) — not left at
 * a shared default. `preventScreenCaptureAsync`/`allowScreenCaptureAsync`
 * are keyed specifically so one screen's blur-triggered cleanup can never
 * disable a DIFFERENT screen's protection that happens to still be
 * active; a shared key defeats that isolation and reopens exactly the
 * race this hook exists to avoid (screen A blurs and its cleanup runs
 * `allowScreenCaptureAsync` a moment after screen B has already re-armed
 * prevention with the same key, silently turning B's protection back
 * off).
 */
export function useScreenPrivacy(key: string): void {
  useFocusEffect(
    useCallback(() => {
      ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
      if (process.env.EXPO_OS === 'ios') {
        ScreenCapture.enableAppSwitcherProtectionAsync().catch(() => undefined);
      }
      return () => {
        ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined);
        if (process.env.EXPO_OS === 'ios') {
          ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]),
  );
}
