import { useUtilityStorePoles } from "@/providers/UtilityStoreProvider";
import { Accuracy, getCurrentPositionAsync } from "expo-location";
import { createAssetAsync } from "expo-media-library";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { CameraPhotoOutput } from "react-native-vision-camera";
import { requestSavePermission } from "./Helpers";

interface ITakePhotoProps {
  flashMode?: "off" | "on";
}
interface ICameraOutputs {
  photoOutput: CameraPhotoOutput
}
export function useCameraController({ photoOutput }: ICameraOutputs ) {
  const { addPole } = useUtilityStorePoles();
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const onInitialized = useCallback(() => {
    setIsInitialized(true);
  }, []);

  const takePhoto = useCallback(
    async ({ flashMode = "off" }: ITakePhotoProps) => {
      try {
        setIsCapturing(true);
        const locationResult = await getCurrentPositionAsync({
          accuracy: Accuracy.High,
        });
        const photo = await photoOutput.capturePhoto(
          { flashMode},{ });
        //const image = await photo.toImageAsync()
        const hasPermission = await requestSavePermission();
        if (!hasPermission) {
          Alert.alert(
            "Permission denied!",
            "Camera does not have permission to save the media.",
          );
          return;
        }
        const path = await photo.saveToTemporaryFileAsync(100);
        await createAssetAsync(`file:///${path}`, "photo");
        const encodedData = await photo.getFileDataAsync()
        // Upload to backend:
        /*await fetch('https://my-backend.com/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: Buffer.from(encodedData)
        })*/
        await addPole({
          latitude: locationResult.coords.latitude,
          longitude: locationResult.coords.longitude,
          timestamp: Date.now(),
          imageUri: path,
          detectionConfidence: 80, //get confidence from AI detections
        } as any);
        return router.navigate("/poles/maps");
      } 
      catch (e) {
        console.error("Photo capture failed:", e);
      } 
      finally {
        setIsCapturing(false);
      }
    },
    [addPole,photoOutput],


  );

  return {
    isInitialized,
    isCapturing,
    onInitialized,
    takePhoto,
  };
}
