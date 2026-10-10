import type { SupportedLanguage } from './rtl';

/**
 * Translations for values that live in the DATABASE as English strings,
 * not in the UI catalogue — `property_amenities.amenity` and
 * `properties.type`. These arrive from Supabase already spelled
 * ("Air Conditioning", "Swimming Pool", "Guesthouse"), so `t()` can't reach
 * them: there is no translation key to look up, only a value to map.
 *
 * Ported VERBATIM from `Nouzl_Platform/src/constants/constants.ts`'s
 * `amenityTranslations` / `propertyTypes` so the app and the website say
 * the same Arabic words for the same amenity — the mobile app previously
 * rendered these raw, so an Arabic-language guest saw "Swimming Pool" and
 * "Air Conditioning" in the middle of an otherwise fully Arabic screen.
 *
 * Keys are the exact stored strings and MUST stay byte-identical to the
 * website's table; a near-miss silently falls back to the raw English via
 * `amenityLabel()` below rather than throwing, which is the right failure
 * mode for user data but makes typos invisible.
 */
export const AMENITY_TRANSLATIONS: Record<string, { en: string; ar: string }> = {
  // Basic
  Wifi: { en: 'Wifi', ar: 'واي فاي' },
  Internet: { en: 'Internet', ar: 'انترنت' },
  'Air Conditioning': { en: 'Air Conditioning', ar: 'تكييف هواء' },
  Heating: { en: 'Heating', ar: 'تدفئة' },
  TV: { en: 'TV', ar: 'تلفزيون' },
  Kitchen: { en: 'Kitchen', ar: 'مطبخ' },
  Washer: { en: 'Washer', ar: 'غسالة ملابس' },
  Dryer: { en: 'Dryer', ar: 'مجفف ملابس' },
  Iron: { en: 'Iron', ar: 'مكواة' },
  // Recreational
  'Swimming Pool': { en: 'Swimming Pool', ar: 'مسبح' },
  Gym: { en: 'Gym', ar: 'صالة رياضية' },
  Sauna: { en: 'Sauna', ar: 'ساونا' },
  'Hot Tub': { en: 'Hot Tub', ar: 'جاكوزي' },
  BBQ: { en: 'BBQ', ar: 'شواية' },
  Garden: { en: 'Garden', ar: 'حديقة' },
  Balcony: { en: 'Balcony', ar: 'شرفة' },
  'Beach Access': { en: 'Beach Access', ar: 'وصول للشاطئ' },
  // Services
  Breakfast: { en: 'Breakfast', ar: 'إفطار' },
  Dinner: { en: 'Dinner', ar: 'عشاء' },
  '24hr Reception': { en: '24hr Reception', ar: 'استقبال 24 ساعة' },
  'Cleaning Service': { en: 'Cleaning Service', ar: 'خدمة تنظيف' },
  'Airport Shuttle': { en: 'Airport Shuttle', ar: 'مواصلات للمطار' },
  Concierge: { en: 'Concierge', ar: 'كونسيرج' },
  'Room Service': { en: 'Room Service', ar: 'خدمة الغرف' },
  Parking: { en: 'Parking', ar: 'موقف سيارات' },
  'Wheelchair Accessible': { en: 'Wheelchair Accessible', ar: 'ملائم للكراسي المتحركة' },
  'Self Check-in': { en: 'Self Check-in', ar: 'دخول ذاتي' },
  'Car Entrance': { en: 'Car Entrance', ar: 'مدخل سيارة' },
  // Views
  'Mountain View': { en: 'Mountain View', ar: 'اطلالة على الجبل' },
  'Garden View': { en: 'Garden View', ar: 'اطلالة على الحديقة' },
  'Mountain Waterfall': { en: 'Mountain Waterfall', ar: 'شلال على الجبل' },
};

/**
 * Ionicons equivalents of the website's lucide icons — same amenity, same
 * visual idea, drawn from the icon set this app already bundles rather
 * than adding a second one. Duplicates are deliberate and match the
 * website's own table (it uses `Utensils` for both Kitchen and Dinner,
 * `Car` for both Parking and Car Entrance, and so on).
 */
export const AMENITY_ICONS: Record<string, string> = {
  Wifi: 'wifi',
  Internet: 'globe-outline',
  'Air Conditioning': 'snow-outline',
  Heating: 'flame-outline',
  TV: 'tv-outline',
  Kitchen: 'restaurant-outline',
  Washer: 'sync-outline',
  Dryer: 'shirt-outline',
  Iron: 'thermometer-outline',
  'Swimming Pool': 'water-outline',
  Gym: 'barbell-outline',
  Sauna: 'flame-outline',
  'Hot Tub': 'thermometer-outline',
  BBQ: 'bonfire-outline',
  Garden: 'leaf-outline',
  Balcony: 'business-outline',
  'Beach Access': 'umbrella-outline',
  Breakfast: 'cafe-outline',
  Dinner: 'restaurant-outline',
  '24hr Reception': 'time-outline',
  'Cleaning Service': 'sparkles-outline',
  'Airport Shuttle': 'bus-outline',
  Concierge: 'notifications-outline',
  'Room Service': 'restaurant-outline',
  Parking: 'car-outline',
  'Wheelchair Accessible': 'accessibility-outline',
  'Self Check-in': 'key-outline',
  'Car Entrance': 'car-sport-outline',
  'Mountain View': 'triangle-outline',
  'Garden View': 'leaf-outline',
  'Mountain Waterfall': 'water-outline',
};

/** Fallback matches the website's own `|| Check`. */
const AMENITY_FALLBACK_ICON = 'checkmark-circle';

/** `properties.type` → label. Verbatim from the website's `propertyTypes`. */
export const PROPERTY_TYPE_TRANSLATIONS: Record<string, { en: string; ar: string }> = {
  Apartment: { en: 'Apartments and Houses', ar: 'الشقق المخدومة ومنازل نزل' },
  Hotel: { en: 'Hotel', ar: 'فندق' },
  Resort: { en: 'Resorts and Chalets', ar: 'منتجعات وشاليهات' },
  Guesthouse: { en: 'Huts and Camps', ar: 'أكواخ ومخيمات' },
  BreakNouzl: { en: 'Break Nouzl', ar: 'بريك نُزل' },
};

/** Translated amenity label, falling back to the raw stored string so an
 *  amenity the catalogue doesn't know still renders as itself. */
export function amenityLabel(amenity: string, language: SupportedLanguage): string {
  return AMENITY_TRANSLATIONS[amenity]?.[language] ?? amenity;
}

/** Ionicons name for an amenity, or a generic tick for unknown ones. */
export function amenityIcon(amenity: string): string {
  return AMENITY_ICONS[amenity] ?? AMENITY_FALLBACK_ICON;
}

/** Translated property-type label, falling back to the raw stored value. */
export function propertyTypeLabel(type: string | null | undefined, language: SupportedLanguage): string {
  if (!type) return '';
  return PROPERTY_TYPE_TRANSLATIONS[type]?.[language] ?? type;
}
