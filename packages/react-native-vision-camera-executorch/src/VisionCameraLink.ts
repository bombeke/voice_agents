import type { Frame, FrameProcessorPlugin } from "react-native-vision-camera";
import { VisionCameraProxy } from "react-native-vision-camera";
import { ParameterType } from "./TagsDetectorFrameProcessor.types";

let plugin: FrameProcessorPlugin | null = null;

export function detectTags(
  frame: Frame,
  options?: Record<string, ParameterType>,
): ParameterType {
  "worklet";

  if (!plugin) {
    throw new Error("detectTags not initialized");
  }

  return plugin.call(frame, options);
}

export const isDetectTagsInitialized = () => {
  return plugin !== null;
};

export const initializeDetectTags = (modelPath: string) => {
  plugin = VisionCameraProxy.initFrameProcessorPlugin("detectTags", {
    modelPath,
  }) as FrameProcessorPlugin | null;

  if (!plugin) {
    throw new Error("Failed to initialize detectTags plugin");
  }
};
