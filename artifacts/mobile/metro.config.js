// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

// Exclude transient/non-source directories from file watching to prevent ENOENT crashes
config.resolver.blockList = [
  new RegExp(`${workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/\\.local\\/.*`),
  /.*\/\.tmp-[^/].*$/,
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.assetExts.push("tflite", "bin", "onnx", "ncnn", "pte");

const WEB_STUBS = {
  "react-native-vision-camera": path.resolve(projectRoot, "web-stubs/react-native-vision-camera.js"),
  "react-native-vision-camera-executorch": path.resolve(projectRoot, "web-stubs/react-native-vision-camera-executorch.js"),
  "react-native-vision-camera-location": path.resolve(projectRoot, "web-stubs/react-native-vision-camera-location.js"),
  "react-native-worklets-core": path.resolve(projectRoot, "web-stubs/react-native-worklets-core.js"),
  "react-native-worklets": path.resolve(projectRoot, "web-stubs/react-native-worklets.js"),
  "vision-camera-resize-plugin": path.resolve(projectRoot, "web-stubs/vision-camera-resize-plugin.js"),
  "react-native-reanimated": path.resolve(projectRoot, "web-stubs/react-native-reanimated.js"),
  "react-native-mmkv": path.resolve(projectRoot, "web-stubs/react-native-mmkv.js"),
  //"react-native-webrtc": path.resolve(projectRoot, "web-stubs/react-native-webrtc.js"),
  //"react-native-webrtc-web-shim": path.resolve(projectRoot, "web-stubs/react-native-webrtc-web-shim.js"),
  "react-native-incall-manager": path.resolve(projectRoot, "web-stubs/react-native-incall-manager.js"),
  "react-native-video": path.resolve(projectRoot, "web-stubs/react-native-video.js"),
  "@lodev09/react-native-exify": path.resolve(projectRoot, "web-stubs/lodev09-react-native-exify.js"),
  "@maplibre/maplibre-react-native": path.resolve(projectRoot, "web-stubs/maplibre-react-native.js"),
  "@react-native-camera-roll/camera-roll": path.resolve(projectRoot, "web-stubs/react-native-camera-roll.js"),
  "@react-native-community/netinfo": path.resolve(projectRoot, "web-stubs/react-native-community-netinfo.js"),
  "@shopify/react-native-skia": path.resolve(projectRoot, "web-stubs/shopify-react-native-skia.js"),
  "@signalwire/react-native": path.resolve(projectRoot, "web-stubs/signalwire-react-native.js"),
  "expo-secure-store": path.resolve(projectRoot, "web-stubs/expo-secure-store.js"),
  "react-native-executorch": path.resolve(projectRoot, "web-stubs/react-native-executorch.js"),
  "react-native-executorch-expo-resource-fetcher": path.resolve(projectRoot, "web-stubs/react-native-executorch-expo-resource-fetcher.js"),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_STUBS[moduleName]) {
    return { filePath: WEB_STUBS[moduleName], type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withUniwindConfig(config, { cssEntryFile: "./global.css" });
