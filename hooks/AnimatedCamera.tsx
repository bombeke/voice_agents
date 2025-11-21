import { ExifTags, readAsync } from '@lodev09/react-native-exify';
import { nanoid } from 'nanoid/non-secure';
import { useRef } from 'react';
import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Camera } from 'react-native-vision-camera';

// Create the animated component
const AnimatedCamera = Animated.createAnimatedComponent(Camera as any);

// Animated props for the Camera (example for animated `zoom`)
const useAnimatedCameraProps = (zoomValue: SharedValue<number>) =>
  useAnimatedProps(() => ({
    zoom: zoomValue.value,
  }));

export { AnimatedCamera, useAnimatedCameraProps };



export default function CameraCapture({ onSaved }: any) {
const camRef = useRef<any>(null);


async function take() {
const photo = await camRef.current.takePhoto({ skipMetadata: false });
// photo.path is file path
const exif: ExifTags = await readAsync(photo.path);
const lat = toDecimal(exif.GPSLatitude, exif.GPSLatitudeRef);
const lng = toDecimal(exif.GPSLongitude, exif.GPSLongitudeRef);
const id = nanoid();


const doc = { id, uri: photo.path, latitude: lat, longitude: lng, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deviceId: 'device-1' };


// Save to rxdb and mmkv via higher-level handler (passed into component) or send event
onSaved && onSaved(doc);
}


return <Camera ref={camRef} style={{ flex: 1 }} />;
}


function toDecimal(dms:any, ref:any) {
if (!dms) return null;
const parts = dms.map(parseFloat);
const dec = parts[0] + parts[1] / 60 + parts[2] / 3600;
return (ref === 'S' || ref === 'W') ? -dec : dec;
}