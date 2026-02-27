import type { Frame } from "react-native-vision-camera";
import { VisionCameraProxy } from "react-native-vision-camera";

let plugin:
  | ReturnType<typeof VisionCameraProxy.initFrameProcessorPlugin>
  | null
  | undefined = null;

/**
 * Initialize the detectTags frame processor plugin.
 * Call this ONCE after prepareModel() resolves.
 */
export function initializeDetectTags(modelPath: string) {
  plugin = VisionCameraProxy.initFrameProcessorPlugin("detectTags", {
    modelPath,
  });

  if (!plugin) {
    throw new Error('Failed to initialize Frame Processor Plugin "detectTags"');
  }
}

/**
 * Worklet-safe synchronous detector call.
 */
export function detectTags(frame: Frame): object | null {
  "worklet";

  if (!plugin) {
    throw new Error(
      "detectTags plugin not initialized. Call initializeDetectTags() first.",
    );
  }

  return plugin.call(frame);
}
