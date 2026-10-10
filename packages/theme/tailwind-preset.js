/**
 * Shared Tailwind v3 preset consumed by both apps' tailwind.config.js via
 * `presets: [require('@nouzl/theme/tailwind-preset')]`.
 *
 * Plain CommonJS on purpose, not TypeScript: Tailwind's CLI/PostCSS pipeline
 * loads this file directly with Node, before Metro (or any bundler) ever
 * touches it, so it can't go through ts-node/Babel the way app code can.
 * Values below must stay in sync with ./src/tokens.ts by hand — there is no
 * build step turning one into the other. If you change a color here, change
 * it there too.
 */
module.exports = {
  darkMode: 'class', // configured but unused — neither web app has dark mode; see tokens.ts's note
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#7e409a',
          hover: '#6a3582',
          light: '#a05fc0',
          tint: '#f4ecf8',
          'tint-border': '#e6d5ef',
          deep: '#57306c',
          shade: '#3d1f4a',
          ink: '#1f0f29',
        },
        breaknouzl: {
          DEFAULT: '#14b8a6',
          deep: '#0891b2',
          tint: '#f0fdfa',
          'tint-border': '#ccfbf1',
        },
        gold: { DEFAULT: '#fbbf24', deep: '#f59e0b', ink: '#b45309' },
        wishlist: '#f87171',
        'accent-blue': {
          DEFAULT: '#3a7ca5',
          tint: '#e7f1f6',
        },
        page: '#f8f7fb',
        card: '#ffffff',
        border: '#ece8f2',
        divider: '#f2f0f6',
        text: '#241b2e',
        'text-secondary': '#8a8398',
        'text-muted': '#b3adc0',
        // Text/icons ON a brand, gold or photo fill (was spelled `text-white`).
        'on-brand': '#ffffff',
        // Legibility wash over photos (counters, captions) — brand ink at 55%.
        scrim: 'rgba(31, 15, 41, 0.55)',
        success: { DEFAULT: '#1f9d55', tint: '#e7f8ee' },
        warning: { DEFAULT: '#c07a13', tint: '#fdf1de' },
        danger: { DEFAULT: '#d1414d', tint: '#fce8ea' },
      },
      borderRadius: {
        chip: '9px',
        row: '12px',
        card: '16px',
        'card-lg': '24px',
      },
      // Actual loaded font names from @expo-google-fonts/cairo — see
      // packages/theme/src/applyDefaultFont.ts for why these exact strings
      // (not a plain "Cairo" family) are what native can resolve, and each
      // app's src/global.css for how font-bold/font-semibold/font-extrabold
      // get mapped onto these too, since Tailwind's own weight utilities
      // can't select a different static TTF by themselves.
      fontFamily: {
        sans: ['Cairo_400Regular'],
        medium: ['Cairo_500Medium'],
        bold: ['Cairo_700Bold'],
        extrabold: ['Cairo_800ExtraBold'],
      },
    },
  },
  plugins: [],
};
