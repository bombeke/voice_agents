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

  console.log("detectTags");
  if (plugin == null)
    throw new Error('Failed to load Frame Processor Plugin "detectTags"!');
  return plugin.call(frame, options);
}
