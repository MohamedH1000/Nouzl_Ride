/**
 * Cairo ships as four separate static TTFs (no variable font), each loaded
 * under its OWN family name by expo-font's useFonts — there is no single
 * "Cairo" family React Native can pick a weight from. Anything that needs a
 * specific weight must name the exact family here (navigation header/tab
 * styles do this); anything rendering normal app text should just use
 * `@nouzl/ui`'s themed `<Text>`, which resolves the weight through
 * global.css's `.font-*` rules.
 *
 * HISTORICAL NOTE — do not reintroduce the `defaultProps` patch that used
 * to live in this file. It set `Text.defaultProps.style = { fontFamily }`,
 * the classic RN recipe for "one font everywhere", and it never worked in
 * this codebase for a structural reason: React resolves `defaultProps` only
 * in the legacy `React.createElement` path, and both apps compile JSX with
 * the AUTOMATIC runtime (`babel-preset-expo` with
 * `jsxImportSource: 'nativewind'`), which emits `jsx(Text, props)` from
 * `react/jsx-runtime` and never consults `defaultProps` at all. Verified
 * against the installed React 19.2.3:
 *
 *   React.createElement(Fn).props.style  ->  { fontFamily: 'Cairo' }
 *   jsx(Fn, {}).props.style              ->  undefined
 *
 * The real mechanism is `@nouzl/ui`'s `<Text>`/`<TextInput>` wrappers — see
 * packages/ui/src/Typography.tsx.
 */
export const CAIRO_FONT_FAMILIES = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  bold: 'Cairo_700Bold',
  extraBold: 'Cairo_800ExtraBold',
} as const;
