// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("tflite", "bin", "onnx", "ncnn");

module.exports = withUniwindConfig(config, { cssEntryFile: "./global.css" });
