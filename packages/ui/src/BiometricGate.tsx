import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, View, type AppStateStatus } from 'react-native';
import { Text } from './Typography';
import * as LocalAuthentication from 'expo-local-authentication';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color } from '@nouzl/theme';
import { Button } from './Button';

export interface BiometricGateProps {
  /** Master switch — pass `false` to render `children` directly with no gate
   *  at all (e.g. the customer app's opt-in preference is off, or the
   *  session isn't signed in yet). When `true`, the gate still transparently
   *  no-ops on a device with no biometrics hardware/enrollment (see below). */
  enabled: boolean;
  /** Shown on the native biometric prompt and, translated by the caller, on
   *  the in-app lock screen and its retry button. */
  promptMessage: string;
  unlockButtonLabel: string;
  lockedTitle: string;
  lockedBody: string;
  children: ReactNode;
}

/**
 * Face ID / fingerprint gate — required on resume for the business app,
 * opt-in for the customer app's wallet screen (see the plan's
 * `packages/auth` section). Deliberately a UI-level component rather than
 * part of `@nouzl/auth`'s session providers: whether to show it, and with
 * what copy, is a per-screen policy decision each app makes for itself
 * (business: always, whenever signed in; customer: only if the user opted
 * in AND only around the wallet screen's content), while the actual
 * hardware check and prompt are identical either way.
 *
 * A device with no biometric hardware or no enrolled Face ID/fingerprint
 * NEVER gets locked out — `enabled` only takes effect once
 * `hasHardwareAsync()` and `isEnrolledAsync()` both resolve true. Locking a
 * user out of their own bookings/financials because they never set up
 * Face ID would be a support ticket, not a security win; the device's own
 * passcode/PIN already gates the OS itself in that case.
 */
export function BiometricGate({ enabled, promptMessage, unlockButtonLabel, lockedTitle, lockedBody, children }: BiometricGateProps) {
  const [available, setAvailable] = useState(false);
  const [checkedAvailability, setCheckedAvailability] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  // Tracks the PREVIOUS AppState so a lock only re-arms on a genuine
  // background→active transition (an 'inactive' blip from, say, a system
  // permission dialog or the app switcher preview must not re-lock).
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!cancelled) {
        setAvailable(hasHardware && isEnrolled);
        setCheckedAvailability(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const shouldGate = enabled && available;

  const attemptUnlock = useCallback(async () => {
    if (authenticating) return;
    setAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: false });
      if (result.success) setUnlocked(true);
    } finally {
      setAuthenticating(false);
    }
  }, [authenticating, promptMessage]);

  // Initial gate: prompt as soon as we know the gate is actually needed.
  useEffect(() => {
    if (shouldGate && !unlocked) void attemptUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldGate]);

  // Re-lock and re-prompt on every return from background — "required on
  // resume" per the plan, not just on cold start.
  useEffect(() => {
    if (!shouldGate) return;
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/background/) && next === 'active') {
        setUnlocked(false);
        void attemptUnlock();
      }
      appState.current = next;
    });
    return () => subscription.remove();
  }, [shouldGate, attemptUnlock]);

  // Not gated at all (disabled, or no biometrics on this device): render
  // straight through. Also true for the one frame before the hardware
  // check resolves — briefly showing real content is far preferable to
  // flashing a lock screen that then immediately disappears on a device
  // that was never going to be gated in the first place.
  if (!shouldGate || unlocked || !checkedAvailability) {
    return <>{children}</>;
  }

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-page px-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
        <Ionicons name="finger-print-outline" size={32} color={color.brand.DEFAULT} />
      </View>
      <Text className="text-center text-lg font-extrabold text-text">{lockedTitle}</Text>
      <Text className="text-center text-sm text-text-secondary">{lockedBody}</Text>
      <Button label={unlockButtonLabel} loading={authenticating} onPress={attemptUnlock} />
    </View>
  );
}
