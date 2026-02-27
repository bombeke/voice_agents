import type { Frame } from "react-native-vision-camera";
import { VisionCameraProxy } from "react-native-vision-camera";

// Define the type of the plugin object returned by initFrameProcessorPlugin
type FrameProcessorPlugin<T = unknown> = {
  call: (frame: Frame, options?: any) => T | null;
};

let plugin: FrameProcessorPlugin<object> | null = null;

/**
 * Initialize the detectTags frame processor plugin.
 * Call this ONCE after prepareModel() resolves.
 */
export function initializeDetectTags(modelPath: string, options?: any) {
  plugin = VisionCameraProxy.initFrameProcessorPlugin("detectTags", {
    ...options,
    modelPath,
  }) as FrameProcessorPlugin<object> | null;

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
