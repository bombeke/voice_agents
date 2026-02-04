// Reexport the native module. On web, it will be resolved to ExecutorchVisionPluginModule.web.ts
// and on native platforms to ExecutorchVisionPluginModule.ts
export { default } from './ExecutorchVisionPluginModule';
export { default as ExecutorchVisionPluginView } from './ExecutorchVisionPluginView';
export * from  './ExecutorchVisionPlugin.types';
import { requireNativeModule } from 'expo-modules-core';

import type { YoloModelConfig, Detection } from './types';
export const ExpoYoloExecuTorchPlugin = requireNativeModule('ExecutorchVisionPlguinModule');

export function registerModels(models: YoloModelConfig[]) {
  return Native.registerModels(models);
}

export function getLatestDetections(): Detection[] {
  return Native.getLatestDetections();
}

// VisionCamera will find the plugin by name automatically
export const YOLO_FRAME_PROCESSOR_NAME = 'YoloFrameProcessor';
