// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18next = require('eslint-plugin-i18next');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    // All user-facing text goes through i18n (CLAUDE.md coding rules).
    files: ['src/**/*.tsx'],
    ignores: ['src/**/__tests__/**'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'error',
    },
  },
]);
