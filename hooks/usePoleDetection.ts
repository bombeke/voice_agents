import { useCachedTensorModel } from "@/components/ModelContext";
import { useRef, useState } from "react";
import { Dimensions } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useSharedValue } from "react-native-reanimated";
import { useFrameProcessor } from "react-native-vision-camera";
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

export const handlePredict = async (model: any, image: any) => {
  "worklet";
  try {
    const result = await model.forward(image);
    return result;
  } catch (error) {
    console.error("Model forward error:", error);
    return null;
  }
};

export const useDetectionFrameProcessor = (
  model: any,
  threshold: number,
  results: SharedValue<any[]>,
) => {
  const { resize } = useResizePlugin();
  const isProcessing = useSharedValue(false);

  return useFrameProcessor(
    (frame) => {
      "worklet";
      if (model === null || isProcessing.value) {
        return;
      }

      isProcessing.value = true;

      const resized = resize(frame, {
        scale: {
          width: 300,
          height: 300,
        },
        pixelFormat: "rgb",
        dataType: "uint8",
      });

      handlePredict(model, resized)
        .then((detections: IDetectionObject[] | null) => {
          "worklet";

          if (!detections || detections.length === 0) {
            isProcessing.value = false;
            return;
          }

          console.log("Model results:", detections);

          const objects = processDetection(
            detections,
            frame.width,
            frame.height,
            threshold,
          );

          console.log("results::::", objects);
          results.value = objects;
          isProcessing.value = false;
        })
        .catch((error: any) => {
          "worklet";
          console.error("Detection error:", error);
          isProcessing.value = false;
        });
    },
    [threshold, model, resize, results],
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

  const updateFps = (currentFps: number) => {
    setFps(currentFps);
  };

  const detectionResults = useDetectionResults();
  const frameProcessor = useDetectionFrameProcessor(
    model,
    confidenceThreshold,
    detectionResults,
  );

  return {
    cameraResults,
    detections: detectionResults.value,
    frameProcessorResults,
    frameProcessor,
    fps,
    confidenceThreshold,
    setConfidenceThreshold,
  };
};
