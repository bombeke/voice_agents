import { useCallback, useEffect, useState } from "react";
import {
    SSDLITE_320_MOBILENET_V3_LARGE,
    useObjectDetection,
} from "react-native-executorch";
export const useCachedModel = () => {
  //const {model, state} = useTensorflowModel(require('@/assets/ssd_mobilenet_v1.tflite'));

  const [cachedModel, setCachedModel] = useState<any | null>(null);
  const model = useObjectDetection({ model: SSDLITE_320_MOBILENET_V3_LARGE });

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

  useEffect(() => {
    /*if(state === 'loaded' && model){
            setCachedModel(model);
        }*/
    if (model.isReady) {
      setCachedModel(model);
    }
  }, [model]);

  return {
    model: cachedModel,
    state: model.isReady,
    predict: runModel,
  };
};
