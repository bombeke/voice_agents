// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const path = require("path");

//const projectRoot = __dirname;
const config = getDefaultConfig(__dirname);
//const workspaceRoot = path.resolve(projectRoot, "../..");

//const config = getDefaultConfig(projectRoot);
config.resolver.assetExts.push("tflite", "bin", "onnx", "ncnn", "pte");

//config.watchFolders = [workspaceRoot];
//config.watchFolders = [path.resolve(__dirname, "../../packages")];

/*config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  path.join(workspaceRoot, "node_modules"),
];

config.resolver.disableHierarchicalLookup = true;
*/
module.exports = withUniwindConfig(config, { cssEntryFile: "./global.css" });
