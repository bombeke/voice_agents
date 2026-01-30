import { useCallback, useEffect, useRef, useState } from "react";
import {
  SSDLITE_320_MOBILENET_V3_LARGE,
  useObjectDetection,
} from "react-native-executorch";

/**
 * ⚠️ Module-level singleton state
 */
let modelInstance: any | null = null;
let isReady = false;
let listeners = new Set<() => void>();
let initializing = false;

/**
 * Called exactly once from a bootstrap component
 */
export function useInitCachedModel() {
  const model = useObjectDetection({
    model: SSDLITE_320_MOBILENET_V3_LARGE,
  });

  if (!initializing) {
    initializing = true;
  }

  if (model.isReady && !isReady) {
    modelInstance = model;
    isReady = true;
    listeners.forEach((l) => l());
  }

  return isReady;
}

/**
 * Read-only access (no hook)
 */
export function getCachedModel() {
  return modelInstance;
}

/**
 * Subscription API for React
 */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useCachedModel1 = () => {
  const [cachedModel, setCachedModel] = useState<any | null>(null);
  const [isReady, setIsReady] = useState(false);

  const model = useObjectDetection({ model: SSDLITE_320_MOBILENET_V3_LARGE });

  const hasCached = useRef(false);

  useEffect(() => {
    if (model.isReady && !hasCached.current) {
      setCachedModel(model);
      setIsReady(true);
      hasCached.current = true;
    }
  }, [model.isReady]);

  const runModel = useCallback(
    async (image: any) => {
      if (!cachedModel) return [];

      const detections = await cachedModel.forward(image);

      for (const detection of detections) {
        console.log("Bounding box: ", detection.bbox);
        console.log("Bounding label: ", detection.label);
        console.log("Bounding score: ", detection.score);
      }

      return detections;
    },
    [cachedModel],
  );

  return {
    model: cachedModel,
    state: isReady,
    predict: runModel,
  };
};

export const useCachedModel = () => {
  const [ready, setReady] = useState(() => !!getCachedModel());

  useEffect(() => {
    if (ready) return;

    return subscribe(() => {
      setReady(true);
    });
  }, [ready]);

  const runModel = useCallback(async (image: any) => {
    const model = getCachedModel();
    if (!model) return [];

    const detections = await model.forward(image);
    for (const detection of detections) {
      console.log("Bounding box: ", detection.bbox);
      console.log("Bounding label: ", detection.label);
      console.log("Bounding score: ", detection.score);
    }

    return detections;
  }, []);

  return {
    model: getCachedModel(),
    state: ready,
    predict: runModel,
  };
};
