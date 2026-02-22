import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  useCameraDevice,
  useCameraPermission,
  useLocationPermission,
  useMicrophonePermission,
} from "react-native-vision-camera";

import { CameraControls } from "@/components/camera/CameraControl";
import { CameraView } from "@/components/camera/CameraView";
import { DetectionOverlay } from "@/components/camera/DetectionOverlay";
import { NoCameraDevice } from "@/components/camera/NoCameraDevice";
import { PermissionsPage } from "@/components/camera/PermissionsPage";
import { useCameraController } from "@/hooks/useCameraController";
import { useIsForeground } from "@/hooks/useIsForeground";
import { usePreferredCameraDevice } from "@/hooks/usePreferredCameraDevice";
import { useTagDetection } from "@/hooks/useTagDetection";
import { useIsFocused } from "@react-navigation/core";
import { useSharedValue } from "react-native-reanimated";

export default function CameraScreen() {
  // const device = useCameraDevice("back");
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

  const { cameraRef, isInitialized, isCapturing, onInitialized, takePhoto } =
    useCameraController();

  const { detections, frameProcessor } = useTagDetection(!isCapturing);
  //const { queues, frameProcessor } = usePoleDetection();
  const [detectionsSafe, setDetectionsSafe] = useState<any[]>([]);
  const [preferredDevice] = usePreferredCameraDevice();
  let device = useCameraDevice(cameraPosition);

  if (preferredDevice != null && preferredDevice.position === cameraPosition) {
    // override default device with the one selected by the user in settings
    device = preferredDevice;
  }

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
        frameProcessor={frameProcessor?.frameProcessor}
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
