import { pitchRoll, horizontalFov } from "@/helpers/arGeometry";
import type {
  ArCameraPose,
  CameraIntrinsics,
  CaptureLocation,
  CaptureMetadata,
  GnssFix,
  SensorCameraPose,
} from "@/types/Capture";

/** Diagonal of 35 mm film, for 35 mm-equivalent focal lengths. */
const FILM_DIAGONAL_MM = Math.hypot(36, 24);

/**
 * Focal length in pixels from a 35 mm-equivalent focal length (EXIF
 * FocalLengthIn35mmFilm, or the camera device's nominal one). The standard
 * scales by the diagonal, so this holds for any aspect ratio.
 */
export function focalPxFrom35mm(
  focal35mm: number | null | undefined,
  size: { width: number; height: number },
): number | null {
  if (!focal35mm || focal35mm <= 0) return null;
  return (focal35mm * Math.hypot(size.width, size.height)) / FILM_DIAGONAL_MM;
}

export function intrinsicsOf(
  size: { width: number; height: number },
  focalLengthPx: number | null,
  focalLengthMm: number | null = null,
): CameraIntrinsics {
  return {
    width: size.width,
    height: size.height,
    focalLengthPx,
    focalLengthMm,
    horizontalFovDeg: horizontalFov(size.width, focalLengthPx),
  };
}

export interface MetadataInput {
  engine: CaptureMetadata["engine"];
  intrinsics: CameraIntrinsics;
  location: CaptureLocation;
  latest: GnssFix | null;
  heading: number | null;
  pose: ArCameraPose | null;
  /** Sensor attitude, for shots without AR. */
  sensor?: SensorCameraPose | null;
  cameraHeightM: number | null;
  model: string;
  inferenceMs: number | null;
}

/** The photo's provenance record: phone fix, lens, AR pose and detector. */
export function buildCaptureMetadata(input: MetadataInput): CaptureMetadata {
  const { location, latest, pose } = input;
  const sensor = pose ? null : (input.sensor ?? null);
  const tilt = pose ? pitchRoll(pose) : sensor;
  return {
    engine: input.engine,
    intrinsics: input.intrinsics,
    device: {
      latitude: location.latitude,
      longitude: location.longitude,
      altitude: location.altitude,
      accuracy: location.accuracy,
      altitudeAccuracy: latest?.altitudeAccuracy ?? null,
      heading: input.heading,
      pitchDeg: tilt?.pitchDeg ?? null,
      rollDeg: tilt?.rollDeg ?? null,
    },
    ar: pose,
    sensor,
    cameraHeightM: input.cameraHeightM,
    detector: { model: input.model, inferenceMs: input.inferenceMs },
  };
}
