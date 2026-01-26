import { useCachedTensorModel } from "@/components/ModelContext";
import { useRef, useState } from "react";
import { Dimensions } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { runAsync, useFrameProcessor } from "react-native-vision-camera";
import { useRunOnJS } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";

type DetectionObject = {
  id: number;
  label?: string;
  score: number;
  boundingBox: {
    x: number; // normalized (0–1)
    y: number; // normalized (0–1)
    width: number; // normalized (0–1)
    height: number; // normalized (0–1)
  };
};

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
let lastFrameTime = 0;
export const usePoleDetection = () => {
  const labels = require("@/assets/labels.json");
  const [cameraResults, setCameraResults] = useState<any[]>([]);
  const frameProcessorResults = useSharedValue<any[]>([]);
  const { resize } = useResizePlugin();
  const model = useCachedTensorModel(); // Yolo11n.tflite using react-native-fast-tflite
  const lastInference = useRef(0);
  const [detections, setDetections] = useState<any[]>([]);
  const [fps, setFps] = useState(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const processDetection1 = (
    outputs: any,
    sWidth: any,
    sHeight: any,
    threshold: any,
  ) => {
    "worklet";

    if (!outputs || outputs.length < 4) return [];

    const boxes = outputs[0]; // Object with string keys (40 elements: 10 detections × 4 coordinates each)
    const classes = outputs[1]; // Object with string keys (class indices)
    const scores = outputs[2]; // Object with string keys (confidence scores)
    const numDetections = outputs[3][0]; // Single value: number of valid detections

    const detectedObjects = [];
    const count = Math.min(numDetections, 10);

    for (let i = 0; i < count; i++) {
      // All outputs are objects with string keys
      const score = scores[i.toString()];

      if (score < threshold) continue;

      const classIndex = Math.floor(classes[i.toString()]);
      const label = labels[classIndex.toString()] || `Class ${classIndex}`;

      // Get bounding box coordinates (normalized 0-1)
      const ymin = boxes[(i * 4 + 0).toString()];
      const xmin = boxes[(i * 4 + 1).toString()];
      const ymax = boxes[(i * 4 + 2).toString()];
      const xmax = boxes[(i * 4 + 3).toString()];

      const object = {
        id: `${i}-${performance.now()}`,
        label,
        confidence: score,
        box: {
          x: Math.max(0, xmin * sWidth),
          y: Math.max(0, ymin * sHeight),
          width: Math.min(sWidth, (xmax - xmin) * sWidth),
          height: Math.min(sHeight, (ymax - ymin) * sHeight),
        },
      };

      detectedObjects.push(object);
    }
    return detectedObjects;
  };

  const processDetection = (
    detections: DetectionObject[],
    sWidth: number,
    sHeight: number,
    threshold: number,
  ) => {
    "worklet";

    if (!detections || detections.length === 0) return [];

    const detectedObjects = [];

    for (let i = 0; i < detections.length; i++) {
      const detection = detections[i];

      if (detection.score < threshold) continue;

      const {
        boundingBox: { x, y, width, height },
        score,
        label,
      } = detection;

      detectedObjects.push({
        id: `${detection.id}-${performance.now()}`,
        label: label ?? "Unknown",
        confidence: score,
        box: {
          x: Math.max(0, x * sWidth),
          y: Math.max(0, y * sHeight),
          width: Math.min(sWidth, width * sWidth),
          height: Math.min(sHeight, height * sHeight),
        },
      });
    }

    return detectedObjects;
  };

  const updateDetectionsOnJS = useRunOnJS(
    (detections) => {
      if (detections) {
        setDetections(detections);
      } else {
        setDetections([]);
      }
    },
    [setDetections],
  );

  const updateFpsOnJS = useRunOnJS(
    (currentFps) => {
      setFps(currentFps);
    },
    [setFps],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      if (model === null) {
        return;
      }

      // Calculate FPS using shared value for persistence
      const currentTime = performance.now();
      const storedLastTime = lastFrameTime || 0;

      if (storedLastTime > 0) {
        const timeDiff = currentTime - storedLastTime;
        const currentFps = Math.round(1000 / timeDiff);
        updateFpsOnJS(currentFps);
      }
      lastFrameTime = currentTime;

      //const result = model.runSync([resized])
      runAsync(frame, () => {
        "worklet";
        const resized = resize(frame, {
          scale: {
            width: 300,
            height: 300,
          },
          pixelFormat: "rgb",
          dataType: "uint8",
        });
        const result = model.forward(resized);
        const processedDetections = processDetection(
          result,
          screenWidth,
          screenHeight,
          confidenceThreshold,
        );
        updateDetectionsOnJS(processedDetections);
      });
    },
    [model, confidenceThreshold, screenWidth, screenHeight],
  );

  return { cameraResults, detections, frameProcessorResults, frameProcessor };
};
