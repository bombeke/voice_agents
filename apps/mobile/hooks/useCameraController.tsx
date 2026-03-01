import { useUtilityStorePoles } from "@/providers/UtilityStoreProvider";
import { Accuracy, getCurrentPositionAsync } from "expo-location";
import { createAssetAsync } from "expo-media-library";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { Camera } from "react-native-vision-camera";
import { requestSavePermission } from "./Helpers";

interface ITakePhotoProps {
  flash?: "off" | "on";
}
export function useCameraController() {
  const cameraRef = useRef<Camera>(null);
  const { addPole } = useUtilityStorePoles();
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const onInitialized = useCallback(() => {
    setIsInitialized(true);
  }, []);

  const takePhoto = useCallback(
    async ({ flash = "off" }: ITakePhotoProps) => {
      if (!cameraRef?.current) return;
      try {
        setIsCapturing(true);
        const locationResult = await getCurrentPositionAsync({
          accuracy: Accuracy.High,
        });
        const photo = await cameraRef.current.takePhoto({ flash });
        const hasPermission = await requestSavePermission();
        if (!hasPermission) {
          Alert.alert(
            "Permission denied!",
            "Camera does not have permission to save the media.",
          );
          return;
        }
        await createAssetAsync(`file:///${photo.path}`, "photo");

        await addPole({
          latitude: locationResult.coords.latitude,
          longitude: locationResult.coords.longitude,
          timestamp: Date.now(),
          imageUri: photo.path,
          detectionConfidence: 80, //get confidence from AI detections
        } as any);
        return router.navigate("/poles/maps");
      } catch (e) {
        console.error("Photo capture failed:", e);
      } finally {
        setIsCapturing(false);
      }
    },
    [addPole],
  );

  return {
    cameraRef,
    isInitialized,
    isCapturing,
    onInitialized,
    takePhoto,
  };
}
