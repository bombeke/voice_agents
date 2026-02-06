// Reexport the native module. On web, it will be resolved to ExecutorchVisionPluginModule.web.ts
// and on native platforms to ExecutorchVisionPluginModule.ts
export * from "./ExecutorchVisionPlugin.types";
export { default } from "./ExecutorchVisionPluginModule";
export { default as ExecutorchVisionPluginView } from "./ExecutorchVisionPluginView";

import { requireNativeModule } from "expo-modules-core";
import type { Detection, YoloModelConfig } from "./types";

const NativeModule = requireNativeModule("ExecutorchVisionPluginModule");

export const ExpoYoloExecuTorchPlugin = NativeModule;

export function registerModels(models: YoloModelConfig[]) {
  return NativeModule.registerModels(models);
}

export function getLatestDetections(): Detection[] {
  return NativeModule.getLatestDetections();
}

// VisionCamera will find the plugin by name automatically
export const YOLO_FRAME_PROCESSOR_NAME = "YoloFrameProcessor";
