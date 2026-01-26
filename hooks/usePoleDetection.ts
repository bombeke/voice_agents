import { useCachedTensorModel } from "@/components/ModelContext";
import { useRef, useState } from "react";
import { Dimensions } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useSharedValue } from "react-native-reanimated";
import { runAsync, useFrameProcessor } from "react-native-vision-camera";
import { useRunOnJS } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";

export interface IBoundingBox {
  x: number; // normalized (0–1)
  y: number; // normalized (0–1)
  width: number; // normalized (0–1)
  height: number; // normalized (0–1)
}
export interface IDetectionObject {
  id: number;
  label?: string;
  score: number;
  boundingBox: {
    x: number; // normalized (0–1)
    y: number; // normalized (0–1)
    width: number; // normalized (0–1)
    height: number; // normalized (0–1)
  };
}

export interface IDetectionObjectResult extends IDetectionObject {
  confidence: number;
  box: IBoundingBox;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
let lastFrameTime = 0;

export const processDetection = (
  detections: IDetectionObject[],
  sWidth: number,
  sHeight: number,
  threshold: number,
) => {
  "worklet";

  const detectedObjects: Partial<IDetectionObjectResult>[] = [];
  if (!detections) return detectedObjects;

  for (let i = 0; i < detections.length; i++) {
    const d = detections[i];
    if (d.score < threshold) continue;

    detectedObjects.push({
      id: d.id, // stable
      label: d.label ?? "Unknown",
      confidence: d.score,
      box: {
        x: d.boundingBox.x * sWidth,
        y: d.boundingBox.y * sHeight,
        width: d.boundingBox.width * sWidth,
        height: d.boundingBox.height * sHeight,
      },
    });
  }

  return detectedObjects;
};

export const useDetectionResults = () => {
  const results = useSharedValue<any[]>([]);
  return results;
};

export const useDetectionFrameProcessor = (
  model: any,
  threshold: number,
  results: SharedValue<any[]>,
) => {
  const { resize } = useResizePlugin();

  return useFrameProcessor(
    (frame) => {
      "worklet";
      if (model === null) {
        return;
      }
      return runAsync(frame, () => {
        "worklet";
        const resized = resize(frame, {
          scale: {
            width: 300,
            height: 300,
          },
          pixelFormat: "rgb",
          dataType: "uint8",
        });

        const detections: IDetectionObject[] = model.forward(resized);
        console.log("Model results:", detections);
        if (!detections || detections.length === 0) return;

        const objects = processDetection(
          detections,
          frame.width,
          frame.height,
          threshold,
        );
        console.log("results::::", objects);
        results.value = objects;
      });
    },
    [threshold],
  );
};

export const usePoleDetection = () => {
  const labels = require("@/assets/labels.json");
  const [cameraResults, setCameraResults] = useState<any[]>([]);
  const frameProcessorResults = useSharedValue<any[]>([]);

  const model = useCachedTensorModel(); // Yolo11n.tflite using react-native-fast-tflite
  const lastInference = useRef(0);

  const [fps, setFps] = useState(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);

  const updateFpsOnJS = useRunOnJS(
    (currentFps) => {
      setFps(currentFps);
    },
    [setFps],
  );

  const detectionResults = useDetectionResults();

  const frameProcessor = useDetectionFrameProcessor(
    model,
    0.5,
    detectionResults,
  );

  return {
    cameraResults,
    detections: detectionResults.value,
    frameProcessorResults,
    frameProcessor,
  };
};
