const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require("path");
 
const config = getDefaultConfig(__dirname)
config.transformer.unstable_allowRequireContext = true;
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false
  }
});
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@': __dirname, // this makes @ point to project root
};

config.watchFolders = [
  __dirname, // include root for module resolution
];

module.exports = withNativeWind(config, { input: './app/global.css' })