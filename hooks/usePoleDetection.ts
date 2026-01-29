import { useCachedTensorModel } from "@/components/ModelContext";
import { useMemo, useRef, useState } from "react";
import { Dimensions } from "react-native";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { runAsync, useFrameProcessor } from "react-native-vision-camera";
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

export const handlePredictJS = async (model: any, image: Uint8Array | any) => {
  try {
    return await model.forward(image);
  } catch (e) {
    console.error("Model forward error:", e);
    return null;
  }
};
export const useDetectionQueues = () => {
  const inferenceQueue = useSharedValue<any[]>([]);
  const detectionResults = useSharedValue<any[]>([]);
  const isInferring = useSharedValue(false);

  // FPS governor
  const lastInferenceTs = useSharedValue(0);
  const targetFps = useSharedValue(5); // default cap

  return {
    inferenceQueue,
    detectionResults,
    isInferring,
    lastInferenceTs,
    targetFps,
  };
};

export const runModelInferenceJS = async (
  model: any,
  image: any,
  inferenceQueue: { value: any[] },
  isInferring: { value: boolean },
) => {
  try {
    const detections = await model.forward(image);
    if (detections?.length) {
      inferenceQueue.value = [...inferenceQueue.value, detections];
    }
  } catch (e) {
    console.error("Inference error:", e);
  } finally {
    isInferring.value = false;
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
    inferenceQueue,
    detectionResults,
    isInferring,
    lastInferenceTs,
    targetFps,
  } = queues;

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";

      const now = nowMs();
      const minInterval = 1000 / targetFps.value;

      // 1️⃣ Drain inference results queue
      if (inferenceQueue.value.length > 0) {
        const detections = inferenceQueue.value.shift();

        const objects = processDetection(
          detections,
          frame.width,
          frame.height,
          threshold,
        );

        detectionResults.value = objects;
      }

      // 2️⃣ FPS governor
      if (now - lastInferenceTs.value < minInterval) {
        return;
      }

      // 3️⃣ Backpressure lock
      if (!model.isReady || isInferring.value) return;

      isInferring.value = true;
      lastInferenceTs.value = now;

      // 4️⃣ Resize frame (cheap, worklet-safe)
      const resized = resize(frame, {
        scale: { width: 300, height: 300 },
        pixelFormat: "rgb",
        dataType: "uint8",
      });

      // 5️⃣ Fire async inference
      return runAsync(frame, () => {
        "worklet";
        return runOnJS(runModelInferenceJS)(
          model,
          resized,
          inferenceQueue,
          isInferring,
        );
      });
    },
    [threshold, model.isReady],
  );

  return frameProcessor;
};

export const usePoleDetection = () => {
  const labels = require("@/assets/labels.json");
  const model = useCachedTensorModel();
  console.log("Model is Ready:", model.isReady);
  const queues = useDetectionQueues();
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

  return useMemo(
    () => ({
      detections: queues.detectionResults.value,
      frameProcessor,
      fps,
      confidenceThreshold,
      setConfidenceThreshold,
    }),
    [frameProcessor, fps, confidenceThreshold],
  );
};
