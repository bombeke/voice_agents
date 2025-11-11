// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Required for NativeWind + Expo SDK 53
config.transformer.unstable_allowRequireContext = true;

// CI-friendly symlinks (safe)
config.resolver.unstable_enableSymlinks = true;

module.exports = withNativeWind(config, { input: "./app/global.css" });
