import { ExifTags, readAsync } from "@lodev09/react-native-exify";
import { createAssetAsync } from "expo-media-library";
import { nanoid } from "nanoid/non-secure";
import { useRef } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedProps,
} from "react-native-reanimated";
import {
  Camera as RNCamera,
  useCameraDevice,
} from "react-native-vision-camera";
import { withUniwind } from "uniwind";
import { toDecimal } from "./Helpers";
import { useMMKVValue } from "./useMMKVVlaue";

// Animated vision-camera
const AnimatedCamera = Animated.createAnimatedComponent(RNCamera as any);
const Camera = withUniwind(RNCamera);

// Animated props
export const useAnimatedCameraProps = (zoomValue: SharedValue<number>) =>
  useAnimatedProps(() => ({
    zoom: zoomValue.value,
  }));

export { AnimatedCamera };

//export function CameraCapture({ onSaved }: any) {
export function CameraCapture() {
  const [data, setData] = useMMKVValue("photos", []);
  const camRef = useRef<RNCamera>(null);
  const device = useCameraDevice("back");

  async function take() {
    try {
      const photo: any = await camRef.current?.takePhoto();
      if (!photo) return;
      const assetPhoto = await createAssetAsync(photo.path);
      console.log("B0XXXX:", assetPhoto);
      const exif: ExifTags | undefined = await readAsync(assetPhoto.uri);

      const lat = toDecimal(exif?.GPSLatitude, exif?.GPSLatitudeRef);
      const lng = toDecimal(exif?.GPSLongitude, exif?.GPSLongitudeRef);
      const id = nanoid();

      const doc: any = {
        id,
        uri: assetPhoto.uri,
        latitude: lat,
        longitude: lng,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deviceId: "device-1",
      };

      //onSaved?.(doc);
      data.push(doc);
      setData(data);
    } catch (err) {
      console.error("Failed to take photo:", err);
      Alert.alert("Camera Error", "Failed to take photo");
    }
  }

  if (!device) return null;

  return (
    <View className="flex-1">
      <Camera
        ref={camRef}
        className="flex-1"
        device={device}
        photo={true}
        isActive={true}
      />

      {/* Capture button */}
      <TouchableOpacity
        onPress={take}
        className="absolute bottom-10 self-center w-[70px] h-[70px] rounded-full bg-surface"
      />
    </View>
  );
}
