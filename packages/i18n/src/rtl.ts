import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';

export const SUPPORTED_LANGUAGES = ['ar', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Arabic is the default across both web apps — nouzl_business's
 *  architecture.md states it explicitly, and Nouzl_Platform's unprefixed
 *  (canonical) locale is also Arabic. Match that here. */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'ar';

const STORAGE_KEY = 'nouzl.language';
/** Caps the boot-time RTL fixup below to at most one automatic reload per
 *  install — see syncNativeDirectionAtBoot()'s docblock. */
const RTL_BOOT_RELOAD_GUARD_KEY = 'nouzl.rtlBootReloadAttempted';

export function isRtl(language: SupportedLanguage): boolean {
  return language === 'ar';
}

/**
 * Reads the persisted language preference synchronously-enough for app
 * boot: call this BEFORE the first render (in the root layout's module
 * scope or an early effect gated behind a splash screen), never after,
 * because I18nManager.forceRTL() does not take visual effect until the next
 * JS bundle load — RN reads I18nManager.isRTL once at native module init and
 * caches it. Getting this right at boot is the difference between "the app
 * opens RTL" and "the app opens LTR and silently ignores the pref until a
 * later reload".
 */
export async function getStoredLanguage(): Promise<SupportedLanguage> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {
    // AsyncStorage unavailable (first launch, storage error) — fall through
    // to the default rather than block boot on it.
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Applies I18nManager RTL state to match `language` if it doesn't already,
 * persists the preference, and reloads the app via expo-updates so the new
 * direction actually takes effect. Call this from a language switcher — NOT
 * from boot code, which should instead read getStoredLanguage() and trust
 * that I18nManager was already set correctly by the previous call to this
 * function.
 *
 * allowRTL is set alongside forceRTL — on some Android OEM builds
 * forceRTL() alone does not stick without allowRTL() also being true.
 */
export async function setLanguageAndReload(language: SupportedLanguage): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, language);

  // Switch the COPY first, and unconditionally.
  //
  // This line was missing, and the language switcher did nothing at all in
  // Expo Go — verified on device: tapping "English" on an Arabic build left
  // every string in Arabic. The old code only persisted the preference and
  // poked I18nManager, on the stated assumption that the copy "changes,
  // which i18next's language-changed event handles live". Nothing in this
  // function ever told i18next anything, so there was no such event.
  //
  // The reason it appeared to work in a production build is that ar and en
  // happen to have OPPOSITE directions, so a switch always took the reload
  // path below and the new language got picked up on the way back up
  // through getStoredLanguage(). Two same-direction languages (en/fr, say)
  // would have exposed it immediately — and so does any environment where
  // reloadAsync is unavailable, which is every Expo Go session.
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  const shouldBeRtl = isRtl(language);
  // Direction already matches; the copy above was the only thing to change.
  if (I18nManager.isRTL === shouldBeRtl) return;

  I18nManager.allowRTL(shouldBeRtl);
  I18nManager.forceRTL(shouldBeRtl);
  if (!Updates.reloadAsync) return;

  try {
    // A deliberate switch always gets to try its own reload, regardless of
    // whether the ONE boot-time auto-reload below already fired for this
    // install — clearing the guard here means a later reinstall or an edge
    // case that somehow left isRTL disagreeing again still gets its
    // automatic fixup at next boot instead of being silently skipped
    // forever.
    await AsyncStorage.removeItem(RTL_BOOT_RELOAD_GUARD_KEY).catch(() => undefined);
    await Updates.reloadAsync();
  } catch {
    // Expo Go, and any dev client without update channels, rejects here.
    // Swallow it: this used to reject straight into the switcher's onPress
    // as an unhandled rejection. The copy has already changed by this
    // point, so the only thing left stale is the native layout direction,
    // which syncNativeDirectionAtBoot() fixes on the next launch.
  }
}

/**
 * Boot-time sync: call once, early, before the first paint (e.g. at the top
 * of the root _layout.tsx, gated behind the splash screen). Ensures
 * I18nManager already agrees with the persisted language BEFORE i18next
 * initializes, so there is never a frame rendered in the wrong direction.
 *
 * On a MISMATCH (typically first launch ever, since native `I18nManager`
 * starts LTR and the persisted/default language is Arabic), this used to
 * call forceRTL() and just return, deferring the actual visual flip to
 * "whenever the next reload happens to occur" — but forceRTL() takes effect
 * on the NEXT bundle load, not this one, and for a fresh single-session
 * install there may never BE a next reload. The result wasn't "one frame in
 * the wrong direction" as originally assumed; it was the ENTIRE first
 * session rendering text in Arabic (i18next-driven, works immediately)
 * while every direction-sensitive LAYOUT behavior — flex-row ordering, the
 * native stack header's back-button chevron, anything reading
 * I18nManager.isRTL directly — stayed mirrored for LTR, because that flag
 * is cached at native module init and only a reload re-reads it. So this
 * now forces that one reload immediately, capped by a guard so a device
 * where forceRTL() genuinely never sticks (some OEM builds) degrades to
 * "fix on the next natural reload" instead of looping forever.
 */
export async function syncNativeDirectionAtBoot(): Promise<SupportedLanguage> {
  const language = await getStoredLanguage();
  const shouldBeRtl = isRtl(language);

  if (I18nManager.isRTL === shouldBeRtl) {
    // Already correct — clear the guard so a FUTURE genuine mismatch (a
    // reinstall, a manually-cleared app direction, ...) still gets its own
    // automatic fixup rather than being silently skipped because of a
    // guard left over from a previous install.
    await AsyncStorage.removeItem(RTL_BOOT_RELOAD_GUARD_KEY).catch(() => undefined);
    return language;
  }

  I18nManager.allowRTL(shouldBeRtl);
  I18nManager.forceRTL(shouldBeRtl);

  let alreadyAttempted = false;
  try {
    alreadyAttempted = (await AsyncStorage.getItem(RTL_BOOT_RELOAD_GUARD_KEY)) === 'true';
  } catch {
    // AsyncStorage unavailable — proceed as not-yet-attempted. Worst case
    // is one avoidable reload, not a loop: this whole branch only runs
    // while isRTL disagrees with the persisted language in the first
    // place, and a successful reload makes that condition false next boot.
  }

  if (!alreadyAttempted && Updates.reloadAsync) {
    try {
      // Written BEFORE the call, deliberately: reloadAsync() tears down this
      // runtime, so there is no "after" in which to record the attempt, and
      // without the guard a device where forceRTL() never sticks would
      // reload on every single boot.
      await AsyncStorage.setItem(RTL_BOOT_RELOAD_GUARD_KEY, 'true');
      await Updates.reloadAsync();
      // Nothing below this line executes on a successful call.
    } catch {
      // Expo Go, and any dev client without update channels configured,
      // rejects here.
      //
      // The guard MUST come back off in that case. It was set a moment ago
      // to survive a reload that then never happened, so leaving it set
      // means this branch is skipped on every future launch — permanently.
      // That is not hypothetical: it is why a build whose very first launch
      // happened somewhere reloadAsync() is unavailable would keep rendering
      // native chrome (the stack's own back chevron, the tab bar) left-to-
      // right in Arabic forever, with no way to recover short of clearing
      // app data. Removing it costs at most one extra reload attempt on the
      // next launch, and only while the direction is genuinely still wrong.
      await AsyncStorage.removeItem(RTL_BOOT_RELOAD_GUARD_KEY).catch(() => undefined);
    }
  }

  return language;
}
