// https://docs.expo.dev/guides/using-eslint/
// eslint-config-prettier comes last so formatting is Prettier's job alone.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // Config files run in Node (CommonJS), not in the app.
    files: ['*.config.js'],
    languageOptions: { globals: { __dirname: 'readonly', module: 'writable', require: 'readonly' } },
  },
  {
    ignores: ['dist/*', '.expo/*'],
  },
]);
