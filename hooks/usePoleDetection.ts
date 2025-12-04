import { useCachedTensorModel } from "@/components/ModelContext";
import { useCallback, useRef, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import { useFrameProcessor } from "react-native-vision-camera";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { parseYOLO } from "./parseYoloModel";

export const usePoleDetection = () => {
    const [cameraResults, setCameraResults] = useState<any[]>([]);
    const frameProcessorResults = useSharedValue<any[]>([]);
    const { resize } = useResizePlugin();
    const model = useCachedTensorModel(); // Yolo11n.tflite using react-native-fast-tflite
    const lastInference = useRef(0);
    
    console.log("POLEResult model:", model);

    const updateCameraResults = useCallback((results: any[]) => {
        setCameraResults(results);
    }, []);
    const runObjectDetectionAsync = useCallback(async (rgbFloatNorm:  Float32Array) => {
      if (!model) return

      //try {
        console.log("IXmage1")
        const input = {
          data: rgbFloatNorm,
          shape: [1, 640, 640, 3],
          dataType: "float32",
        };
      const outputs = model.run([input]);
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
        console.log(`POLEDetected ${num_detections} objects!`)
        const pred = outputs[0]; // YOLO output

        const detections = parseYOLO(pred as Float32Array);
        frameProcessorResults.value = detections;
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

            // update state if you want UI overlays
            // setDetections(...)
            //} 
            //catch (e) {
            //   console.warn("TF async failed", e)
            //}
        },
        [model]
    )

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
      // -------------- Throttle to ~10 FPS --------------
      const now = frame.timestamp / 1000000; // microseconds → ms
      if (now - lastInference.current < 80) return;
      lastInference.current = now;

      // -------------- Resize natively --------------
      const resized = resize(frame, {
        scale: { 
          width: 640, 
          height: 640 
        },
        pixelFormat: "rgb",
        dataType: "float32",
      });

  
      console.log("IXmage2")
//try {
        console.log("IXmage1")
        const input = {
          data: resized,
          shape: [1, 640, 640, 3],
          dataType: "float32",
        };
      const outputs = model.runSync([input]);
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
        console.log(`POLEDetected ${num_detections} objects!`)
        const pred = outputs[0]; // YOLO output

        const detections = parseYOLO(pred as Float32Array);
        frameProcessorResults.value = detections;
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

            // update state if you want UI overlays
            // setDetections(...)
            //} 
            //catch (e) {
            //   console.warn("TF async failed", e)
            //}

      // Push result back to JS thread safely
      //scheduleOnRN(runObjectDetectionAsync, resized);

          // -------------- Convert to JS-friendly array --------------
      const arr = resized;//.toArray(); // Float32Array 0–255 RGB

      // -------------- Normalize 0–1 for YOLO --------------
      for (let i = 0; i < arr.length; i++) {
        arr[i] = arr[i] / 255;
      }
      console.log("POLEEND")
  }, [model, frameProcessorResults, runObjectDetectionAsync]);

  return { cameraResults, frameProcessorResults, frameProcessor };
};
