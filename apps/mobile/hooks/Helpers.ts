import { Skia } from '@shopify/react-native-skia';
import { PermissionsAndroid, Platform } from "react-native";

// Convert DMS EXIF to decimal degrees
export function toDecimal(dms: any, ref: any) {
  if (!dms) return null;
  const parts = dms.map(parseFloat);
  const dec = parts[0] + parts[1] / 60 + parts[2] / 3600;
  return ref === 'S' || ref === 'W' ? -dec : dec;
}


export const requestSavePermission = async (): Promise<boolean> => {
  // On Android 13 and above, scoped storage is used instead and no permission is needed
  if (Platform.OS !== 'android' || Platform.Version >= 33) return true

  const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
  if (permission == null) return false
  let hasPermission = await PermissionsAndroid.check(permission)
  if (!hasPermission) {
    const permissionRequestResult = await PermissionsAndroid.request(permission)
    hasPermission = permissionRequestResult === 'granted'
  }
  return hasPermission
}


export  function rgbaToFloatRGB(rgba: any, w: number, h: number) {
  const out = new Float32Array(w * h * 3);
  let j = 0;

  for (let i = 0; i < rgba.length; i += 4) {
    out[j++] = rgba[i] / 255;
    out[j++] = rgba[i + 1] / 255;
    out[j++] = rgba[i + 2] / 255;
  }
  return out;
}



export function base64ToTensor(base64: any) {
  const image: any = Skia.Image.MakeImageFromEncoded(
    Skia.Data.fromBase64(base64)
  );

  const rgba = image.readPixels();          // Uint8ClampedArray RGBA
  const width = image.width();
  const height = image.height();

  const out = new Float32Array(width * height * 3);
  let j = 0;

  for (let i = 0; i < rgba.length; i += 4) {
    out[j++] = rgba[i] / 255;     // R
    out[j++] = rgba[i + 1] / 255; // G
    out[j++] = rgba[i + 2] / 255; // B
  }

  return { tensor: out, width, height };
}
