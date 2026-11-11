const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // SDK 57 adds this diagnostic. Keep existing socket, timer, and modal
      // synchronization visible without refactoring gameplay during an SDK upgrade.
      "react-hooks/set-state-in-effect": "warn",
    },
  }
]);
