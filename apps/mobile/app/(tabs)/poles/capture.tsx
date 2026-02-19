import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  useCameraDevice,
  useCameraPermission,
  useLocationPermission,
} from "react-native-vision-camera";

import { CameraControls } from "@/components/camera/CameraControl";
import { CameraView } from "@/components/camera/CameraView";
import { DetectionOverlay } from "@/components/camera/DetectionOverlay";
import { NoCameraDevice } from "@/components/camera/NoCameraDevice";
import { PermissionsPage } from "@/components/camera/PermissionsPage";
import { useCameraController } from "@/hooks/useCameraController";
import { useTagDetection } from "@/hooks/useTagDetection";

export default function CameraScreen() {
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const location = useLocationPermission();
  const [flash, setFlash] = useState<"off" | "on">("off");

  const { cameraRef, isInitialized, isCapturing, onInitialized, takePhoto } =
    useCameraController();

  const { detections, frameProcessor } = useTagDetection(!isCapturing);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  const allowCameraLocationPermissions = async () => {
    await requestPermission();
    await location.requestPermission();
    return;
  };
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
  if (device == null) return <NoCameraDevice />;

  return (
    <View style={styles.container}>
      <CameraView
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
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
    backgroundColor: "#000",
  },
});
