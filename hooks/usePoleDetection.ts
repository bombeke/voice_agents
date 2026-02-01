import { useRef, useState } from "react";
import { Dimensions } from "react-native";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { runAsync, useFrameProcessor } from "react-native-vision-camera";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { useCachedModel } from "./useCachedModel";

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

export const runModelInferenceJS = async (
  model: any,
  image: any,
  inferenceResult: { value: any[] | null },
  isInferring: { value: boolean },
) => {
  try {
    const detections = await model.forward(image);
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

export const useDetectionFrameProcessor = (
  model: any,
  threshold: number,
  queues: ReturnType<typeof useDetectionQueues>,
) => {
  const { resize } = useResizePlugin();

  const {
    inferenceResult,
    detectionResults,
    isInferring,
    lastInferenceTs,
    targetFps,
    paused,
  } = queues;

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      console.log("M0");
      if (paused.value) return;
      console.log("M1");
      const now = nowMs();
      const minInterval = 1000 / targetFps.value;

      // 1) Consume latest result (if any)
      if (inferenceResult.value != null) {
        const detections = inferenceResult.value;
        inferenceResult.value = null; // clear slot

        detectionResults.value = processDetection(
          detections,
          frame.width,
          frame.height,
          threshold,
        );
      }

      // 2) FPS gate
      console.log("M2");
      if (now - lastInferenceTs.value < minInterval) return;
      console.log("M3");

      // 3) In-flight gate
      if (!model || isInferring.value) return;
      console.log("M4");
      // 4) Lock + timestamp BEFORE scheduling
      isInferring.value = true;
      lastInferenceTs.value = now;

      const resized = resize(frame, {
        scale: { width: 300, height: 300 },
        pixelFormat: "rgb",
        dataType: "uint8",
      });
      console.log("M5");
      // 5) Schedule async inference
      runAsync(frame, () => {
        console.log("M6");
        runOnJS(runModelInferenceJS)(
          model,
          resized,
          inferenceResult,
          isInferring,
        );
        console.log("M7");
      });
      console.log("M8");
    },
    [model, threshold],
  );
  console.log("M9");
  return frameProcessor;
};

export const usePoleDetection = () => {
  const labels = require("@/assets/labels.json");
  const { model, predict } = useCachedModel();

  const queues = useDetectionQueues();
  console.log("Model is Ready:", queues);
  const lastInference = useRef(0);
  const [fps, setFps] = useState(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);

  const updateFps = (currentFps: number) => {
    setFps(currentFps);
  };

  //const detectionResults = useDetectionResults();
  const frameProcessor = useDetectionFrameProcessor(
    model,
    confidenceThreshold,
    queues,
  );

  const pauseDetection = () => {
    queues.paused.value = true;
    queues.inferenceQueue.value = [];
    queues.isInferring.value = false;
  };

  const resumeDetection = () => {
    queues.paused.value = false;
  };

  return {
    queues,
    frameProcessor,
    pauseDetection,
    resumeDetection,
    fps,
    confidenceThreshold,
    setConfidenceThreshold,
  };
};
