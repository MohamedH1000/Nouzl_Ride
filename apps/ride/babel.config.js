// NativeWind v4 needs its Babel preset to turn `className` props into styles
// (v5 does not; this repo is on v4 to match nouzl_mobile, spec 0001).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
