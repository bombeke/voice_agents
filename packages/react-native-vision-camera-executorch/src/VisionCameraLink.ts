import { Frame, VisionCameraProxy } from "react-native-vision-camera";

const options = {
  modelPath: "/data/local/tmp/model.pte",
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
  if (plugin == null) {
    console.error("Plugin not initialized");
    return {};
  }
  return plugin.call(frame, options);
}
