// NativeWind v4 (unlike v5) needs a Babel preset to transform `className`
// props into styles — do not remove this thinking it is v5's setup, whose
// skill explicitly does NOT need babel.config.js. That guidance is for the
// Tailwind v4 / react-native-css preview stack this project deliberately
// did not choose (see the plan's styling decision: NativeWind v4 +
// Tailwind v3, for stability).
module.exports = function (api) {
  const isTest = api.cache.using(() => process.env.NODE_ENV) === 'test';
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Jest only: babel-preset-expo leaves dynamic import() for Metro, which
    // Jest can't load (the push helpers lazy-import expo-notifications).
    plugins: isTest ? [require.resolve('../../babel.jest-dynamic-import')] : [],
  };
};
