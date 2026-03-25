import { useRef, useState } from "react";
import { Dimensions } from "react-native";
import { runOnJS, useSharedValue } from "react-native-reanimated";
//import { useCachedModel } from "./useCachedModel";

// Pre-allocate buffers to avoid Garbage Collection (GC) pressure during video frames
const inputSize = 224 * 224 * 3; // Example for MobileNet
const outputSize = 1000;
const inputData = new Float32Array(inputSize);
const outputData = new Float32Array(outputSize);

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

export const handlePredictJS = async (model: any, image: Uint8Array | any) => {
  try {
    return await model.forward(image);
  } catch (e) {
    console.error("Model forward error:", e);
    return null;
  }
};
export const useDetectionQueues = () => {
  const inferenceResult = useSharedValue<any[] | null>(null); // single-slot
  const detectionResults = useSharedValue<any[]>([]);
  const isInferring = useSharedValue(false);
  const paused = useSharedValue(false);

  // FPS governor
  const lastInferenceTs = useSharedValue(0);
  const targetFps = useSharedValue(5);

  return {
    inferenceResult,
    detectionResults,
    isInferring,
    paused,
    lastInferenceTs,
    targetFps,
  };
};

export const runModelInferenceJS = (
  model: any,
  frame: any,
  inferenceResult: { value: any[] | null },
  isInferring: { value: boolean },
) => {
  try {
    const detections: any = [];
    inferenceResult.value = detections ?? [];
    return detections ?? [];
  } catch (e) {
    console.error("Inference error:", e);
    inferenceResult.value = [];
    return [];
  } finally {
    isInferring.value = false; // ALWAYS unlock
  }
};

export const nowMs = () => {
  "worklet";
  return global.performance.now();
};

export const usePoleDetection = () => {
  const labels = require("@/assets/labels.json");
  //const { model, predict } = useCachedModel();

  const queues = useDetectionQueues();
  const lastInference = useRef(0);
  const [fps, setFps] = useState(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);

  const updateFps = (currentFps: number) => {
    setFps(currentFps);
  };

  //const detectionResults = useDetectionResults();
  const pauseDetection = () => {
    queues.paused.value = true;
    queues.inferenceResult.value = null;
    queues.isInferring.value = false;
  };

  const resumeDetection = () => {
    queues.paused.value = false;
  };

  return {
    queues,
    pauseDetection,
    resumeDetection,
    fps,
    confidenceThreshold,
    setConfidenceThreshold,
  };
};
