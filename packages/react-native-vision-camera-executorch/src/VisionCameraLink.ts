import { Frame, VisionCameraProxy } from "react-native-vision-camera";
const plugin = VisionCameraProxy.initFrameProcessorPlugin("detectTags", {});

/**
 * Scans Tags.
 */
export function detectTags(frame: Frame): object | any {
  "worklet";
  if (plugin == null)
    throw new Error('Failed to load Frame Processor Plugin "scanFaces"!');
  return plugin.call(frame);
}
