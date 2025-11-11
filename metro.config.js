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
config.resolver.alias = {
  "@": path.resolve(__dirname)
};
 
module.exports = withNativeWind(config, { input: './app/global.css' })