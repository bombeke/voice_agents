import { Frame, VisionCameraProxy } from "react-native-vision-camera";

const plugin = VisionCameraProxy.initFrameProcessorPlugin("detectTags", {});

/**
 * Scans Tags.
 */
export function detectTags(frame: Frame, options?: any): object | any {
  "worklet";
  if (plugin == null) {
    return {};
  }
  return plugin.call(frame, options);
}
