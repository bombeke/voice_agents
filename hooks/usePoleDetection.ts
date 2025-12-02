import { useCachedTensorModel } from "@/components/ModelContext";
import { useCallback, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import { useFrameProcessor } from "react-native-vision-camera";
import { useResizePlugin } from "vision-camera-resize-plugin";

export const usePoleDetection = () => {
    const [cameraResults, setCameraResults] = useState<any[]>([]);
    const frameProcessorResults = useSharedValue<any[]>([]);
    const { resize } = useResizePlugin();
    const model = useCachedTensorModel();
    console.log("POLEResult model:", model);

    const updateCameraResults = useCallback((results: any[]) => {
        setCameraResults(results);
    }, []);

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";

    if (model == null) {
      // still loading model
      return;
    }

      // Debug frame info
      console.log(
        `POLEFRAME::::${frame.timestamp}: ${frame.width}x${frame.height} ${frame.pixelFormat} Frame (${frame.orientation})`
      );

      // Resize on native thread (fast)
      const resized = resize(frame, {
        scale: { 
            width: 640, 
            height: 640 
        },
        pixelFormat: "rgb",
        dataType: "float32",
      });
      console.log("POLEResult resized:", resized?.length);
      // IMPORTANT:
      // Most TFLite JSI runners want a single tensor, not `[tensor]`
      // Keep `[resized]` ONLY if your model specifically requires multi-input
      const outputs = model.runSync([resized]);
      console.log("POLEResult outputs:", outputs?.length ?? "no result");
      // Most YOLO TFLite models return:
      // [boxes, scores, classes, num_detections]
      const num = Array.isArray(outputs) && outputs.length >= 4
        ? outputs?.[3]?.[0]
        : 0;

        console.log("POLEResult num_detections:", num);
        const detection_boxes = outputs?.[0]
        const detection_classes = outputs?.[1]
        const detection_scores = outputs?.[2]
        const num_detections = outputs?.[3]
        console.log(`POLEDetected ${num_detections?.[0]} objects!`)
        if(frameProcessorResults.value){
            frameProcessorResults.value = [...frameProcessorResults.value, { num_detections, detection_boxes, detection_classes, detection_scores }];
        }
        /*
        for (let i = 0; i < detection_boxes.length; i += 4) {
            const confidence = detection_scores[i / 4]
            if (confidence > 0.7) {
                // 4. Draw a red box around the detected object!
                const left = detection_boxes[i]
                const top = detection_boxes[i + 1]
                const right = detection_boxes[i + 2]
                const bottom = detection_boxes[i + 3]
                const rect = SkRect.Make(left, top, right, bottom)
                canvas.drawRect(rect, SkColors.Red)
            }
        }*/
      // Push result back to JS thread safely
      //scheduleOnRN(updateCameraResults, outputs);
  }, [model, frameProcessorResults]);

  return { cameraResults, frameProcessor };
};
