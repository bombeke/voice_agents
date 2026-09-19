import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

const CAPTURES_DIR = "captures";

const hasScheme = (uri: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(uri);

/** Camera paths come back as bare filesystem paths; RN networking and expo-file-system need a file:// URI. */
export const toFileUri = (uri?: string): string | undefined => {
  if (!uri) return undefined;
  if (hasScheme(uri)) return uri;
  return `file://${uri.startsWith("/") ? "" : "/"}${uri}`;
};

const capturesDir = () => new Directory(Paths.document, CAPTURES_DIR);

const isInCapturesDir = (uri: string) => {
  const dir = capturesDir().uri.replace(/\/?$/, "/");
  return uri.startsWith(dir);
};

/**
 * Copies a captured image out of the OS temp/cache directory into the app's
 * document directory, so it survives until it has been uploaded — captures can
 * sit in the offline queue for days and temp files get purged.
 *
 * `cache` lets several detections from the same photo share one copy.
 * Returns the original URI if it can't (or needn't) be copied.
 */
export function persistCaptureImage(
  uri?: string,
  cache?: Map<string, string>,
): string | undefined {
  const src = toFileUri(uri);
  if (!src || Platform.OS === "web" || !src.startsWith("file://")) return src;

  const cached = cache?.get(src);
  if (cached) return cached;

  try {
    if (isInCapturesDir(src)) return src;

    const source = new File(src);
    if (!source.exists) return src;

    const dir = capturesDir();
    dir.create({ idempotent: true, intermediates: true });

    const dest = new File(dir, `${Date.now()}-${source.name || "capture.jpg"}`);
    source.copy(dest);

    cache?.set(src, dest.uri);
    return dest.uri;
  } catch (e) {
    console.warn("[ImageStore] failed to persist capture image", e);
    return src;
  }
}

/** The URI to attach to an upload, or undefined if there is no local file to send. */
export function uploadableImageUri(uri?: string): string | undefined {
  const src = toFileUri(uri);
  if (!src || /^https?:\/\//i.test(src)) return undefined;
  if (Platform.OS === "web" || !src.startsWith("file://")) return src;
  try {
    return new File(src).exists ? src : undefined;
  } catch {
    return undefined;
  }
}

/** Deletes a persisted capture image. Only touches files this module created. */
export function deleteCaptureImage(uri?: string) {
  const src = toFileUri(uri);
  if (!src || Platform.OS === "web" || !isInCapturesDir(src)) return;
  try {
    const file = new File(src);
    if (file.exists) file.delete();
  } catch (e) {
    console.warn("[ImageStore] failed to delete capture image", e);
  }
}
