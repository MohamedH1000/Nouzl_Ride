import { initI18n, type SupportedLanguage } from '@nouzl/i18n';
import ar from '@/i18n/ar.json';
import en from '@/i18n/en.json';

/**
 * Starts the synced @nouzl/i18n catalogue, then merges this app's own strings
 * into it under the `ride.*` keys. The synced package is a read only copy of
 * nouzl_mobile (spec 0001), so ride strings live here, never there.
 */
export function initRideI18n(language: SupportedLanguage) {
  const i18n = initI18n(language);
  i18n.addResourceBundle('ar', 'translation', ar, true, true);
  i18n.addResourceBundle('en', 'translation', en, true, true);
  return i18n;
}
