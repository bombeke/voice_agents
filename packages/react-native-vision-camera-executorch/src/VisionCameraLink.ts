import type { Frame, FrameProcessorPlugin } from "react-native-vision-camera";
import { VisionCameraProxy } from "react-native-vision-camera";
import { ParameterType } from "./TagsDetectorFrameProcessor.types";

let plugin = VisionCameraProxy.initFrameProcessorPlugin("detectTags", {});

export function detectTags(
  frame: Frame,
  options?: Record<string, ParameterType>,
): ParameterType | null {
  "worklet";

  if (!plugin) {
    console.log("detectTags not initialized", plugin);
    return null;
  }

  return plugin.call(frame, options);
}

export const isDetectTagsInitialized = () => {
  "worklet";
  return plugin !== null;
};

export const initializeDetectTags = (modelPath: string) => {
  "worklets";
  if (!plugin) {
    plugin = VisionCameraProxy.initFrameProcessorPlugin("detectTags", {
      modelPath,
    }) as FrameProcessorPlugin | undefined;
  }
  console.log("plugin::::", plugin);
  return plugin;
};
