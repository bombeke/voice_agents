import { useCallback, useState } from "react";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { useFrameProcessor } from "react-native-vision-camera";
import { detectTags } from "react-native-vision-camera-executorch";
import { useResizePlugin } from "vision-camera-resize-plugin";

export interface Detection {
  id: string;
  box: { x: number; y: number; width: number; height: number };
  label: string;
  confidence: number;
}

export function useTagDetection(enabled: boolean) {
  const [detections, setDetections] = useState<Detection[]>([]);
  const lastTimestamp = useSharedValue(0);
  const { resize } = useResizePlugin();

  const updateDetections = useCallback((data: Detection[]) => {
    setDetections(data);
  }, []);

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
      console.log("detecting frames");
      const result = detectTags(frame, {
        modelPath: "/data/local/tmp/model.pte",
      });
      console.log("Inference result2:", result);

      runOnJS(updateDetections)(mockDetection);
    },
    [enabled],
  );

  return {
    detections,
    frameProcessor: frameProcessor,
  };
}
