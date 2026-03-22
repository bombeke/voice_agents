import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  useCameraDevice,
  useCameraPermission,
  useLocationPermission,
  useMicrophonePermission,
  useSkiaFrameProcessor
} from "react-native-vision-camera";

import { useAppReady } from "@/components/AppReadyContext";
import { CameraControls } from "@/components/camera/CameraControl";
import { CameraView } from "@/components/camera/CameraView";

import { NoCameraDevice } from "@/components/camera/NoCameraDevice";
import { PermissionsPage } from "@/components/camera/PermissionsPage";
import { useCameraController } from "@/hooks/useCameraController";
import { useIsForeground } from "@/hooks/useIsForeground";
import { usePreferredCameraDevice } from "@/hooks/usePreferredCameraDevice";
import { Detection } from "@/hooks/useTagDetection";
import { prepareAndInitializeModel } from "@/services/PrepareModel";
import { useIsFocused } from "@react-navigation/core";
import { Skia } from "@shopify/react-native-skia";
import { detectTags } from "react-native-vision-camera-executorch";
import { useSharedValue } from "react-native-worklets-core";
export interface InferResult {
  detections: Detection[],
  frameWidth: number,
  frameHeight: number
}
export default function CameraScreen() {
  // const device = useCameraDevice("back");
  const ready = useAppReady();
  const { hasPermission, requestPermission } = useCameraPermission();
  const location = useLocationPermission();
  const microphone = useMicrophonePermission();
  const lastTimestamp = useSharedValue(0);
  const zoom = useSharedValue(1);
  const isFocussed = useIsFocused();
  const isForeground = useIsForeground();
  const isActive = isFocussed && isForeground;
  const detections = useSharedValue<InferResult  | null | any >(null)

  const [cameraPosition, setCameraPosition] = useState<"front" | "back">(
    "back",
  );
  const [enableHdr, setEnableHdr] = useState(false);
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [enableNightMode, setEnableNightMode] = useState(false);
  //const { resize } = useResizePlugin();
  const { cameraRef, isInitialized, isCapturing, onInitialized, takePhoto } =
    useCameraController();


  //const { detections } = useTagDetection(!isCapturing);
  //const { queues, frameProcessor } = usePoleDetection();
  const [preferredDevice] = usePreferredCameraDevice();
  let device = useCameraDevice(cameraPosition);

  const [modelPath, setModelPath] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const path = await prepareAndInitializeModel();
      setModelPath(path);
    })();
  }, []);

  const detectTagsProcessor = useMemo(() => {
    if (!modelPath) return undefined;
    return detectTags(modelPath);
  }, [modelPath]);

  const frameProcessor = useSkiaFrameProcessor(
    (frame) => {
      "worklet";

      //if (!enabled) return;
      //console.log("Ready:", isDetectTagsInitialized());
      if (detectTagsProcessor === null || detectTagsProcessor === undefined) return;

      // Throttle on worklet thread (200ms)
      if (frame.timestamp - lastTimestamp.value < 100_000_000) return;
      lastTimestamp.value = frame.timestamp;

      // TODO: Replace with real ML inference
      /*const resized = resize(frame, {
        scale: { width: 640, height: 640 },
        pixelFormat: "rgb",
        dataType: "float32",
      });
      */
      const results = detectTagsProcessor(frame) as any;
      const inputSize = 640;
      const frameW = frame.width;   // 640
      const frameH = frame.height;  // 480
      const scale = Math.min(
        inputSize / frameW,
        inputSize / frameH
      );

      const scaledW = frameW * scale;
      const scaledH = frameH * scale;

      const padX = (inputSize - scaledW) / 2;
      const padY = (inputSize - scaledH) / 2;
      console.log("result:::",results)
      const raw = results?.detections ?? [];
      const corrected = raw.map((d: any) => {
        let x1 = (d.x1 - padX) / scale;
        let x2 = (d.x2 - padX) / scale;
        let y1 = (d.y1 - padY) / scale;
        let y2 = (d.y2 - padY) / scale;

        x1 = Math.max(0, x1);
        y1 = Math.max(0, y1);
        x2 = Math.min(frameW, x2);
        y2 = Math.min(frameH, y2);

      return {
        ...d,
        x1,
        x2,
        y1,
        y2,
        width: x2 - x1,
        height: y2 - y1,
      };
    });


      frame.render()
      for (const result of corrected) {
        const paint = Skia.Paint()
        paint.setColor(Skia.Color('red'))
        paint.setStyle(1); // Stroke
        paint.setStrokeWidth(3);
        const rect = Skia.XYWHRect(
          result.x1,
          result.y1,
          result.width,
          result.height
        );
        frame.drawRect(rect, paint)
      }
      detections.value = {
        detections: corrected,
        frameWidth: frame.width,
        frameHeight: frame.height,
      };
    },
    [detectTagsProcessor],
  );

  useEffect(() => {
    location.requestPermission();
  }, [location]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission,requestPermission]);

  const allowCameraLocationPermissions = useCallback(async () => {
    await requestPermission();
    await location.requestPermission();
    return;
  }, [location]);

  const handleCapture = async () => {
    if (!isInitialized || isCapturing) return;
    await takePhoto({ flash });
    return;
  };

  if (preferredDevice != null && preferredDevice.position === cameraPosition) {
    // override default device with the one selected by the user in settings
    device = preferredDevice;
  }

  if (!ready || !modelPath) return null;

  if (!hasPermission)
    return (
      <PermissionsPage
        allowCameraLocationPermissions={allowCameraLocationPermissions}
      />
    );
  if (device === null) return <NoCameraDevice />;

  return (
    <View style={styles.container}>
      <CameraView
        device={device}
        isActive={isActive}
        frameProcessor={ready ? frameProcessor : undefined}
        onInitialized={onInitialized}
        ref={cameraRef}
        detections ={ detections }
      />
      <CameraControls
        onCapture={handleCapture}
        disabled={!isInitialized || isCapturing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
