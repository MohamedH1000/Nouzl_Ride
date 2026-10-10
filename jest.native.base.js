/**
 * Shared Jest setup for native component tests (jest-expo, iOS preset), used
 * by both apps and packages/ui. Tests render through the same Babel +
 * NativeWind + Reanimated stack as a phone, so they catch what web
 * screenshots can't — e.g. the 2026-10-04 bug where every Button rendered
 * with no background on iOS/Android only.
 */
const path = require('path');

// ESM-only packages (and our TS workspace packages) that Jest must transform.
const TRANSFORM = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo(nent)?',
  '@expo(nent)?/.*',
  '@expo-google-fonts/.*',
  'expo-router',
  'react-navigation',
  '@react-navigation/.*',
  'standard-navigation',
  'nativewind',
  'react-native-css-interop',
  'react-native-reanimated',
  'react-native-worklets',
  '@nouzl/.*',
  '@tanstack/.*',
  '@supabase/.*',
  'i18next',
  'react-i18next',
  '@formatjs/.*',
];

module.exports = function nativeJestConfig(rootDir, extra = {}) {
  return {
    preset: 'jest-expo',
    rootDir,
    setupFiles: [path.join(__dirname, 'jest.native.setup.js')],
    testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
    transformIgnorePatterns: [`node_modules/(?!(${TRANSFORM.join('|')}))`],
    ...extra,
  };
};
