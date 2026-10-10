const nativeJestConfig = require('../../jest.native.base');

module.exports = nativeJestConfig(__dirname, {
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
});
