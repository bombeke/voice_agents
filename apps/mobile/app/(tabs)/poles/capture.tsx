import { useCallback, useEffect, useState } from "react";
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
import {
  detectTags,
  initializeDetectTags,
  isDetectTagsInitialized,
} from "react-native-vision-camera-executorch";
import { useSharedValue, Worklets } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";

export default function CameraScreen() {
  // const device = useCameraDevice("back");
  const ready = useAppReady();
  const { hasPermission, requestPermission } = useCameraPermission();
  const location = useLocationPermission();
  const microphone = useMicrophonePermission();
  const zoom = useSharedValue(1);
  const isFocussed = useIsFocused();
  const isForeground = useIsForeground();
  const isActive = isFocussed && isForeground;

  const [cameraPosition, setCameraPosition] = useState<"front" | "back">(
    "back",
  );
  const [enableHdr, setEnableHdr] = useState(false);
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [enableNightMode, setEnableNightMode] = useState(false);
  const { resize } = useResizePlugin();
  const { cameraRef, isInitialized, isCapturing, onInitialized, takePhoto } =
    useCameraController();
  const [modelPath, setModelPath] = useState<string | null>(null);

  //const { detections } = useTagDetection(!isCapturing);
  //const { queues, frameProcessor } = usePoleDetection();
  const [detections, setDetections] = useState<any[]>([]);
  const [preferredDevice] = usePreferredCameraDevice();
  let device = useCameraDevice(cameraPosition);

  const updateDetections = Worklets.createRunOnJS(
    (data: Detection[] | any[]) => {
      setDetections(data);
    },
  );
  useEffect(() => {
    (async () => {
      const path = await prepareAndInitializeModel();
      setModelPath(path);
    })();
  }, []);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";

      //if (!enabled) return;
      console.log("Ready:", isDetectTagsInitialized());
      if (!isDetectTagsInitialized() && modelPath) {
        // @ts-ignore worklet can't access async JS directly
        initializeDetectTags(modelPath);
      }
      console.log("Ready:", isDetectTagsInitialized());

      //if (!isDetectTagsInitialized()) return null;

      // Throttle on worklet thread (200ms)
      //if (frame.timestamp - lastTimestamp.value < 200_000_000) return;
      //lastTimestamp.value = frame.timestamp;

      // TODO: Replace with real ML inference
      const resized = resize(frame, {
        scale: { width: 320, height: 320 },
        pixelFormat: "rgb",
        dataType: "uint8",
      });

      const mockDetection = [
        {
          id: "1",
          box: { x: 100, y: 200, width: 120, height: 200 },
          label: "Pole",
          confidence: 0.87,
        },
      ];

      console.log("Frame0");

      const result = detectTags(frame);
      console.log("Frame1", result);
      updateDetections(result as any[]);
      console.log("Frame2");
    },
    [updateDetections, modelPath],
  );

  useEffect(() => {
    location.requestPermission();
  }, [location]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

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
  console.log("is ready:", ready);

  if (preferredDevice != null && preferredDevice.position === cameraPosition) {
    // override default device with the one selected by the user in settings
    device = preferredDevice;
  }
  if (!ready) return null;

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
        //frameProcessor={frameProcessor?.frameProcessor}
        frameProcessor={ready ? frameProcessor : undefined}
        onInitialized={onInitialized}
        ref={cameraRef}
      />
      <DetectionOverlay detections={detections} />
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
