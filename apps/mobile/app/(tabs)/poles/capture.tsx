import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  useLocationPermission,
  useMicrophonePermission,
} from "react-native-vision-camera";

import { useAppReady } from "@/components/AppReadyContext";
import { CameraControls } from "@/components/camera/CameraControl";
import { CameraView } from "@/components/camera/CameraView";
import { DetectionOverlay } from "@/components/camera/DetectionOverlay";

import { NoCameraDevice } from "@/components/camera/NoCameraDevice";
import { PermissionsPage } from "@/components/camera/PermissionsPage";
import { useCameraController } from "@/hooks/useCameraController";
import { useIsForeground } from "@/hooks/useIsForeground";
import { usePreferredCameraDevice } from "@/hooks/usePreferredCameraDevice";
import { Detection } from "@/hooks/useTagDetection";
import { prepareAndInitializeModel } from "@/services/PrepareModel";
import { useIsFocused } from "@react-navigation/core";
import { detectTags } from "react-native-vision-camera-executorch";
import { scheduleOnRN } from 'react-native-worklets';
import { useSharedValue } from "react-native-worklets-core";

export interface InferResult {
  detections: Detection[];
  frameWidth: number;
  frameHeight: number;
}

export default function CameraScreen() {
  const ready = useAppReady();
  const { hasPermission, requestPermission } = useCameraPermission();
  const location = useLocationPermission();
  const microphone = useMicrophonePermission();

  const lastTimestamp = useSharedValue(0);
  const isFocused = useIsFocused();
  const isForeground = useIsForeground();
  const isActive = isFocused && isForeground;

  //const detectionsSV = useSharedValue<InferResult | null>(null);
  const [detections, setDetections] = useState<InferResult | null>(null);

  const [cameraPosition] = useState<"front" | "back">("back");
  const [flash] = useState<"off" | "on">("off");

  const { cameraRef, isInitialized, isCapturing, onInitialized, takePhoto } =
    useCameraController();

  const [preferredDevice] = usePreferredCameraDevice();
  let device = useCameraDevice(cameraPosition);

  const [modelPath, setModelPath] = useState<string | null>(null);

  const updateDetections = useCallback((results: InferResult | null) => {
    setDetections(results);
  }, []);

  useEffect(() => {
    (async () => {
      const path = await prepareAndInitializeModel();
      setModelPath(path);
    })();
  }, []);

  useEffect(() => {
    location.requestPermission();
    microphone.requestPermission();
  }, [microphone,location]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission,requestPermission]);

  const detectTagsProcessor = useMemo(() => {
    if (!modelPath) return undefined;
    return detectTags(modelPath);
  }, [modelPath]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";

      if (detectTagsProcessor == null) return;
      if (frame.timestamp - lastTimestamp.value < 100_000_000) return; 
      lastTimestamp.value = frame.timestamp;
      const results = detectTagsProcessor(frame) as any;

      const inputSize = 640;
      const frameW = frame.width;
      const frameH = frame.height;

      const scale = Math.min(inputSize / frameW, inputSize / frameH);

      const scaledW = frameW * scale;
      const scaledH = frameH * scale;

      const padX = (inputSize - scaledW) / 2;
      const padY = (inputSize - scaledH) / 2;

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
          y1,
          x2,
          y2,
          width: x2 - x1,
          height: y2 - y1,
        };
      });
      scheduleOnRN(updateDetections, {
        detections: corrected,
        frameWidth: frameW,
        frameHeight: frameH,
      });
    },
    [detectTagsProcessor,updateDetections]
  );




  const allowCameraLocationPermissions = useCallback(async () => { await requestPermission(); await location.requestPermission(); return; }, [location]);
  const handleCapture = async () => {
    if (!isInitialized || isCapturing) return;
    await takePhoto({ flash });
  };

  if (preferredDevice != null && preferredDevice.position === cameraPosition) {
    device = preferredDevice;
  }

  if (!ready || !modelPath) return null;

  if (!hasPermission)
    return (
      <PermissionsPage
        allowCameraLocationPermissions={allowCameraLocationPermissions}
      />
    );

  if (device == null) return <NoCameraDevice />;

  return (
    <View style={styles.container}>
      <CameraView
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
        onInitialized={onInitialized}
        ref={cameraRef}
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <DetectionOverlay detections={detections} />
        
      </View>
{
          /*
          <Canvas style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
            <Rect
              x={100}
              y={100}
              width={200}
              height={200}
              color="red"
              style="stroke"
              strokeWidth={5}
            />
          </Canvas>
          */
        }
      <CameraControls
        onCapture={handleCapture}
        disabled={!isInitialized || isCapturing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});