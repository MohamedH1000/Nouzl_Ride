import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';
import { DEFAULT_LANGUAGE, type SupportedLanguage } from './rtl';

/**
 * `compatibilityJSON: 'v4'` below means i18next's pluralization relies on a
 * real `Intl.PluralRules` — and Android's Hermes ships without one (or with
 * incomplete locale data) unless the binary is built with full ICU data,
 * which Expo/RN does not do by default. Without this, i18next silently
 * falls back to its v3 pluralization (English-shaped: one/other only),
 * which cannot express Arabic's dual/few/many forms correctly — a plural
 * count would just be wrong, not crash, so this is easy to miss until
 * someone actually reads the Arabic output.
 *
 * `polyfill-force` installs unconditionally rather than feature-detecting
 * first — Hermes on some devices reports a `PluralRules` constructor that
 * exists but has no real locale data behind it, which the non-forced
 * `should-polyfill` check can't distinguish from a genuinely working one.
 * Locale data is loaded only for the two languages this app ships.
 */
import '@formatjs/intl-pluralrules/polyfill-force.js';
import '@formatjs/intl-pluralrules/locale-data/ar.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';

export { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, isRtl, getStoredLanguage, setLanguageAndReload, syncNativeDirectionAtBoot } from './rtl';
export type { SupportedLanguage } from './rtl';
export {
  AMENITY_TRANSLATIONS,
  AMENITY_ICONS,
  PROPERTY_TYPE_TRANSLATIONS,
  amenityLabel,
  amenityIcon,
  propertyTypeLabel,
} from './domain';

/**
 * Neither web app has a translation catalogue — every string is an inline
 * `t("عربي","English")` ternary (~28k lines in nouzl_business alone). This
 * catalogue starts intentionally small (shared chrome: common actions, auth,
 * booking basics, loyalty tiers, nav labels) and grows screen-by-screen as
 * each one is built, per the plan — extracting all of it upfront is not a
 * bounded task.
 */
export function initI18n(language: SupportedLanguage = DEFAULT_LANGUAGE) {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources: {
        ar: { translation: ar },
        en: { translation: en },
      },
      lng: language,
      fallbackLng: 'ar',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
  } else if (i18n.language !== language) {
    void i18n.changeLanguage(language);
  }
  return i18n;
}

export default i18n;

export * from './bidi';
