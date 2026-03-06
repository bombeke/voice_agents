import type { Frame } from "react-native-vision-camera";
import { VisionCameraProxy } from "react-native-vision-camera";

import { ParameterType } from "./TagsDetectorFrameProcessor.types";

//let plugin = VisionCameraProxy.initFrameProcessorPlugin("detectTags", {});

export function detectTags(
  modelPath: string,
  options?: Record<string, ParameterType>,
): (frame: Frame) => ParameterType | null {
  "worklet";
  console.log("ModelPath:", modelPath);
  const plugin = VisionCameraProxy.initFrameProcessorPlugin("detectTags", {
    modelPath,
  });
  //@ts-ignore
  return (frame: Frame) => {
    "worklet";
    if (!plugin) {
      console.log("detectTags not initialized", plugin);
      return null;
    }
    return plugin.call(frame, options ?? {});
  };
}

/*
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
*/
