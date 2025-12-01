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