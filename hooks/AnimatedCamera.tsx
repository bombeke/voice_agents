import { ExifTags, readAsync } from '@lodev09/react-native-exify';
import { createAssetAsync } from 'expo-media-library';
import { nanoid } from 'nanoid/non-secure';
import { useRef } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useMMKVValue } from './useMMKVVlaue';

// Animated vision-camera
const AnimatedCamera = Animated.createAnimatedComponent(Camera as any);

// Animated props
export const useAnimatedCameraProps = (zoomValue: SharedValue<number>) =>
  useAnimatedProps(() => ({
    zoom: zoomValue.value,
  }));

export { AnimatedCamera };


//export function CameraCapture({ onSaved }: any) {
export function CameraCapture() {
  const [data, setData] = useMMKVValue('photos',[]);
  const camRef = useRef<Camera>(null);
  const device = useCameraDevice('back');

  async function take() {
    try {
      const photo: any = await camRef.current?.takePhoto();
      
      if (!photo) return;
      const assetPhoto = await createAssetAsync(photo.path);
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
        deviceId: 'device-1',
      };

      //onSaved?.(doc);
      data.push(doc);
      setData(data);
    } catch (err) {
      console.error('Failed to take photo:', err);
      Alert.alert('Camera Error',"Failed to take photo")
    }
  }

  if (!device) return null;

  return (
    <View style={{ flex: 1 }}>
      <Camera
        ref={camRef}
        style={{ flex: 1 }}
        device={device}
        photo={true}
        isActive={true}
      />

      {/* Capture button */}
      <TouchableOpacity
        onPress={take}
        style={{
          position: 'absolute',
          bottom: 40,
          alignSelf: 'center',
          width: 70,
          height: 70,
          borderRadius: 35,
          backgroundColor: 'white',
        }}
      />
    </View>
  );
}


// Convert DMS EXIF to decimal degrees
function toDecimal(dms: any, ref: any) {
  if (!dms) return null;
  const parts = dms.map(parseFloat);
  const dec = parts[0] + parts[1] / 60 + parts[2] / 3600;
  return ref === 'S' || ref === 'W' ? -dec : dec;
}
