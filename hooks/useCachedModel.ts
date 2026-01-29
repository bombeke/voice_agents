import { useCallback, useEffect, useRef, useState } from "react";
import {
  SSDLITE_320_MOBILENET_V3_LARGE,
  useObjectDetection,
} from "react-native-executorch";

export const useCachedModel = () => {
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
