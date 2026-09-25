import { DETECTOR_MODEL_NAME } from "@/constants/DetectorModel";
import {
  buildCaptureMetadata,
  focalPxFrom35mm,
  intrinsicsOf,
} from "@/helpers/captureMetadata";
import { placeDetections } from "@/helpers/detectionPlacement";
import type { Shot } from "@/hooks/useCaptureSession";
import { toFileUri } from "@/services/storage/ImageStore";
import type {
  CaptureLocation,
  CapturedDetection,
  GnssFix,
  SensorCameraPose,
} from "@/types/Capture";
import { read as readExif } from "@lodev09/react-native-exify";
import type {
  CameraDevice,
  CameraPhotoOutput,
} from "react-native-vision-camera";

export interface CameraShotArgs {
  photoOutput: CameraPhotoOutput;
  device: CameraDevice;
  flash: boolean;
  detections: CapturedDetection[];
  location: CaptureLocation;
  latest: GnssFix | null;
  heading: number | null;
  /** The lens attitude from the phone's sensors at the shutter; null without them. */
  sensor: SensorCameraPose | null;
  inferenceMs: number | null;
}

/**
 * A full-resolution photo from VisionCamera (devices without AR). The lens
 * geometry comes from the photo's EXIF, else the camera's nominal 35 mm
 * focal length. Without AR, each detection is ranged from the sensor
 * attitude (tilt + compass) by ground plane and typical size; with no
 * attitude either, detections keep the phone's own position.
 */
export async function shootWithCamera({
  photoOutput,
  device,
  flash,
  detections,
  location,
  latest,
  heading,
  sensor,
  inferenceMs,
}: CameraShotArgs): Promise<Shot> {
  const photo = await photoOutput.capturePhoto(
    { flashMode: flash ? "on" : "off" },
    {},
  );
  const path = await photo.saveToTemporaryFileAsync();
  const sideways =
    photo.orientation === "left" || photo.orientation === "right";
  const w = photo.width ?? 0;
  const h = photo.height ?? 0;
  const size = sideways ? { width: h, height: w } : { width: w, height: h };
  const exif = await readExif(toFileUri(path)!).catch(() => null);
  const focal35 = exif?.FocalLengthIn35mmFilm ?? device.focalLength ?? null;
  const metadata = buildCaptureMetadata({
    engine: "camera",
    intrinsics: intrinsicsOf(
      size,
      focalPxFrom35mm(focal35, size),
      exif?.FocalLength ?? null,
    ),
    location,
    latest,
    // The lens's own bearing beats the compass's (the top edge of the phone).
    heading: sensor?.headingDeg ?? heading,
    pose: null,
    sensor,
    cameraHeightM: null,
    model: DETECTOR_MODEL_NAME,
    inferenceMs,
  });
  return {
    path,
    metadata,
    detections: placeDetections(metadata, detections),
  };
}
