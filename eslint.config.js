// eslint.config.js (ROOT)
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/android/build/**",
      "**/ios/build/**",
      "**/.expo/**",
    ],
  },

  // Optional: overrides for packages (native modules, C++ bindings, etc.)
  {
    files: ["packages/**"],
    rules: {
      // You can relax or tighten rules here if needed
      "no-unused-vars": "warn",
    },
  },
]);
