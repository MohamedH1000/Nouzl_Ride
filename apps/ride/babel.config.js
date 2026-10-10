// NativeWind v4 needs its Babel preset to turn `className` props into styles
// (v5 does not; this repo is on v4 to match nouzl_mobile, spec 0001).
module.exports = function (api) {
  const isTest = api.cache.using(() => process.env.NODE_ENV) === 'test';
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // Jest only: babel-preset-expo leaves dynamic import() for Metro, which Jest can't load.
    plugins: isTest ? [require.resolve('../../babel.jest-dynamic-import')] : [],
  };
};
