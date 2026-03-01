import { useState } from "react";
import { useFrameProcessor } from "react-native-vision-camera";
import {
  detectTags,
  ParameterType,
} from "react-native-vision-camera-executorch";
import { useSharedValue, Worklets } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";

export interface Detection {
  id: string;
  box: { x: number; y: number; width: number; height: number };
  label: string;
  confidence: number;
}

export function useTagDetection(enabled: boolean) {
  const [detections, setDetections] = useState<Detection[] | ParameterType>([]);
  const lastTimestamp = useSharedValue(0);
  const { resize } = useResizePlugin();

  const updateDetections = Worklets.createRunOnJS(
    (data: Detection[] | ParameterType) => {
      setDetections(data);
      return data;
    },
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";

      if (!enabled) return;

      // Throttle on worklet thread (200ms)
      if (frame.timestamp - lastTimestamp.value < 200_000_000) return;
      lastTimestamp.value = frame.timestamp;

      // TODO: Replace with real ML inference
      const resized = resize(frame, {
        scale: { width: 300, height: 300 },
        pixelFormat: "rgb",
        dataType: "uint8",
      });

      const mockDetection = [
        {
          id: "1",
          box: { x: 100, y: 200, width: 120, height: 200 },
          label: "Pole",
          confidence: 0.87,
        },
      ];
      console.log("Frame0");
      const result = detectTags(frame);
      console.log("Frame1");
      updateDetections(result);
      console.log("Frame2");
    },
    [enabled, updateDetections],
  );

  return {
    detections,
    frameProcessor,
  };
}
