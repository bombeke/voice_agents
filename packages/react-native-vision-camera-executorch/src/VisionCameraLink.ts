import type { Frame } from "react-native-vision-camera";
import { VisionCameraProxy } from "react-native-vision-camera";

const options = {
  modelPath: "model.pte",
};
const plugin = VisionCameraProxy.initFrameProcessorPlugin(
  "detectTags",
  options,
);

/**
 * Scans Tags.
 */
export function detectTags(frame: Frame, options?: any): object | any {
  "worklet";

  if (plugin == null)
    throw new Error('Failed to load Frame Processor Plugin "detectTags"!');
  return plugin.call(frame, options);
}
