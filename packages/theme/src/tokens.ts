/**
 * The single source of truth for Nouzl's design tokens across both Expo
 * apps (customer + business).
 *
 * This is a deliberate break from both web repos. Nouzl_Platform declares
 * its brand purple (#7e409a) in three uncoordinated places — tailwind.config.ts,
 * index.css's --purple-primary, and 130+ per-file `const BRAND_COLOR = "#7e409a"`
 * declarations — and context/build-plan.md explicitly lists unifying them as
 * out of scope there. nouzl_business does better (one CSS-variable sheet in
 * app/globals.css) but it is still CSS text, not an importable object either
 * app's code or its Tailwind config can consume directly.
 *
 * Values below are reconciled from both: nouzl_business's app/globals.css
 * (the more complete, disciplined token set — brand scale, status colors,
 * radii, elevation, motion, type scale) plus Nouzl_Platform's
 * tailwind.config.ts / context/ui-tokens.md (brand gradient, BreakNouzl
 * accent). Neither web app has dark mode — both explicitly mark it out of
 * scope — so this is a deliberate single light palette, not an oversight.
 */

export const color = {
  brand: {
    DEFAULT: '#7e409a',
    hover: '#6a3582',
    light: '#a05fc0',
    tint: '#f4ecf8',
    tintBorder: '#e6d5ef',
    deep: '#57306c',
    shade: '#3d1f4a',
    ink: '#1f0f29',
  },
  /** Hourly "BreakNouzl" rentals — deliberately teal, never purple, so an
   *  hourly booking is visually distinct from a nightly stay at a glance. */
  breakNouzl: {
    DEFAULT: '#14b8a6',
    deep: '#0891b2',
    tint: '#f0fdfa',
    tintBorder: '#ccfbf1',
  },
  accentBlue: {
    DEFAULT: '#3a7ca5',
    /** Lighter partner for the onboarding gradient's second stop. */
    light: '#5fa8d3',
    tint: '#e7f1f6',
  },
  /**
   * The "special property" gold. Mirrors Nouzl_Platform's own
   * `from-yellow-400 via-amber-400` treatment, which is why it is gold and
   * not a brand purple — a special listing is meant to read as a different
   * KIND of thing, not a louder version of the same one. Was pasted as raw
   * hex in five places before it was a token.
   */
  gold: {
    DEFAULT: '#fbbf24',
    deep: '#f59e0b',
    ink: '#b45309',
  },
  /** The wishlist heart when it is filled. Deliberately NOT status.danger —
   *  a saved property is a positive act, and reusing the error red made a
   *  filled heart read as a warning. */
  wishlist: '#f87171',
  /** Loyalty tier accents for the digital ID card. */
  tier: {
    classic: '#9ca3af',
    gold: '#d4a017',
  },
  neutral: {
    page: '#f8f7fb',
    card: '#ffffff',
    /** Text/iconography ON a brand or gold fill. A named token so "white"
     *  never has to be spelled as a literal at a call site. */
    onBrand: '#ffffff',
    /** Secondary text / marks on a brand fill — onBrand at 85%. */
    onBrandMuted: 'rgba(255, 255, 255, 0.85)',
    /** Legibility wash over photos — brand.ink at 55%. Tailwind: `bg-scrim`. */
    scrim: 'rgba(31, 15, 41, 0.55)',
    border: '#ece8f2',
    divider: '#f2f0f6',
    text: '#241b2e',
    textSecondary: '#8a8398',
    textMuted: '#b3adc0',
  },
  status: {
    success: '#1f9d55',
    /** Deeper partner for the onboarding gradient's first stop. */
    successDeep: '#15803d',
    successTint: '#e7f8ee',
    warning: '#c07a13',
    warningTint: '#fdf1de',
    danger: '#d1414d',
    dangerTint: '#fce8ea',
    neutral: '#5c5566',
    neutralTint: '#eeecf2',
  },
} as const;

export const radius = {
  chip: 9,
  row: 12,
  card: 16,
  /** Matches Nouzl_Platform's `rounded-3xl` on its property cards — the
   *  plain `card` radius (16) reads noticeably tighter/flatter next to the
   *  website's actual cards side by side. Use for hero/media cards
   *  (property listing cards, image-forward surfaces); `card` stays the
   *  default for everything else (forms, stat tiles, list rows). */
  cardLg: 24,
} as const;

/**
 * Apple's squircle rather than a circular arc.
 *
 * Spread into the `style` of any rounded surface: `style={[continuousCorner,
 * shadow(2)]}`. It CANNOT be expressed as a Tailwind class — NativeWind has
 * no mapping for `borderCurve` (verified: the string appears nowhere in
 * nativewind or react-native-css-interop), so a `rounded-card` class alone
 * always yields a circular corner no matter what the preset declares.
 *
 * iOS-only by design: the prop is inert on Android, which has no equivalent
 * corner-smoothing primitive. That makes it a safe unconditional spread —
 * there is nothing to branch on — but also means it is invisible on an
 * Android emulator, so don't go looking for it there.
 *
 * Never use it on a capsule (a pill, an avatar, a circular icon button).
 * At a radius of half the height the continuous curve has no room to
 * resolve and the shape reads subtly lumpy instead of round.
 */
export const continuousCorner = { borderCurve: 'continuous' } as const;

/**
 * React Native has no CSS box-shadow — these are the same 4 brand-tinted
 * elevation levels nouzl_business's `.elev-1`..`.elev-4` define, expressed
 * as RN shadow props (iOS: shadow*, Android: elevation).
 */
/** The brand purple as bare RGB channels, so anything needing an rgba()
 *  string — elevation shadows, the Touchable ripple, a scrim — can build one
 *  without re-parsing the hex. Keep in sync with color.brand.DEFAULT. */
export const BRAND_RGB = '126, 64, 154';

/**
 * Four brand-tinted elevation steps, as CSS `boxShadow` strings.
 *
 * WHY boxShadow AND NOT shadowColor/shadowOffset/elevation
 * The legacy props are two half-implementations that had to be kept in sync
 * by hand: `shadowColor`/`Opacity`/`Radius`/`Offset` are iOS-only, and
 * `elevation` is Android-only AND is not a shadow at all — it is a
 * Material z-index that also forces an opaque background and reorders
 * overlapping views, which is why an elevated card could clip a sibling on
 * Android and not on iOS. A single `boxShadow` renders the same geometry on
 * both platforms (React Native 0.76+ on the New Architecture, which Expo
 * SDK 57 enables by default) and is what the expo-native-ui guidance asks
 * for.
 *
 * The values below reproduce the previous iOS geometry exactly — same
 * offsets, same blur radii, same opacities — so this is a change of
 * mechanism, not of design.
 */
export const elevation = {
  1: { boxShadow: `0px 1px 4px rgba(${BRAND_RGB}, 0.06)` },
  2: { boxShadow: `0px 2px 8px rgba(${BRAND_RGB}, 0.08)` },
  3: { boxShadow: `0px 4px 16px rgba(${BRAND_RGB}, 0.1)` },
  4: { boxShadow: `0px 8px 24px rgba(${BRAND_RGB}, 0.14)` },
} as const;

/**
 * The only supported way to elevate a surface. Never write a bare
 * `style={{ elevation: N }}` — that is Android-only and was why every
 * "elevated" card in this app had a real shadow on Android and literally
 * none on iOS before these tokens existed.
 */
export function shadow(level: keyof typeof elevation) {
  return elevation[level];
}

export const motion = {
  duration: { fast: 150, base: 240, slow: 400 },
  /** Cubic-bezier control points — feed directly to Reanimated's Easing.bezier(). */
  easeOutExpo: [0.16, 1, 0.3, 1] as const,
  easeSpring: { damping: 15, stiffness: 150 },
} as const;

/**
 * Ported from nouzl_business's type scale — the only one of the two web
 * apps that formalized one. `lineHeight` is a multiplier, not a px value.
 */
export const typeScale = {
  kpi: { fontSize: 24, fontWeight: '800' as const, lineHeight: 1.2 },
  section: { fontSize: 20, fontWeight: '800' as const, lineHeight: 1.25 },
  pageTitle: { fontSize: 16, fontWeight: '800' as const, lineHeight: 1.3 },
  cardTitle: { fontSize: 14, fontWeight: '800' as const, lineHeight: 1.3 },
  label: { fontSize: 13, fontWeight: '700' as const, lineHeight: 1.35 },
  body: { fontSize: 12.5, fontWeight: '400' as const, lineHeight: 1.5 },
  bodyMedium: { fontSize: 12.5, fontWeight: '500' as const, lineHeight: 1.5 },
  caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 1.4 },
  pill: { fontSize: 10.5, fontWeight: '700' as const, lineHeight: 1.2 },
} as const;

/**
 * Cairo covers Arabic + Latin, which is why both web apps use it as the
 * single app-wide font rather than pairing an Arabic face with a Latin
 * one. Native has no single "Cairo" family the way CSS does — each weight
 * loads under its own name via @expo-google-fonts/cairo (see
 * applyDefaultFont.ts's CAIRO_FONT_FAMILIES, the actual source of truth).
 * This object stays for anything that just wants the CSS-style label.
 */
export const font = {
  family: 'Cairo',
  weights: { regular: '400', medium: '500', bold: '700', extrabold: '800' },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
} as const;

export const theme = { color, radius, elevation, motion, typeScale, font, spacing } as const;

export type Theme = typeof theme;
export default theme;
