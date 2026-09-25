import { DEFAULT_CAMERA_HEIGHT_M } from "@/constants/Capture";
import {
  boxBasePoint,
  groundIntersection,
  heightFromTopRay,
  pixelRay,
  projectToGeo,
  type ArHit,
  type ScreenPoint,
} from "@/helpers/arGeometry";
import {
  placePixelWithSensors,
  placeWithSensors,
} from "@/helpers/sensorGeometry";
import type {
  CaptureMetadata,
  CapturedDetection,
  DetectionPosition,
  NormalizedBox,
  PositionSource,
  Vec3,
} from "@/types/Capture";

/**
 * Turning a detection on a photo into the asset's own position, from the
 * photo's capture metadata. Used at the shutter (with live AR hits) and on
 * the review screen (re-placing by tapping the base on the photo).
 */

/** An AR hit → position. Null without a compass heading or AR pose. */
export function placeFromHit(
  meta: CaptureMetadata,
  hit: ArHit,
  source: PositionSource,
): DetectionPosition | null {
  if (!meta.ar || meta.device.heading === null) return null;
  return projectToGeo({
    device: meta.device,
    heading: meta.device.heading,
    pose: meta.ar,
    point: hit.position,
    source,
    hitType: hit.type,
  });
}

/**
 * A pixel of the photo → position, on the ground plane under the lens. The
 * plane's height comes from the AR ground hit when there was one
 * (`ar_tap`/`GroundPlane`), else from a typical hand-held height (rough).
 * Photos without AR use the sensor attitude at the shutter instead.
 */
export function placeFromPixel(
  meta: CaptureMetadata,
  pixel: ScreenPoint,
  source: PositionSource,
): DetectionPosition | null {
  const { ar, intrinsics, device } = meta;
  if (!ar) {
    return meta.sensor ? placePixelWithSensors(meta, meta.sensor, pixel) : null;
  }
  if (!intrinsics.focalLengthPx || device.heading === null) return null;
  const measured = meta.cameraHeightM !== null;
  const ray = pixelRay(ar, intrinsics.focalLengthPx, intrinsics, pixel);
  const point = groundIntersection(
    ar.position,
    ray,
    meta.cameraHeightM ?? DEFAULT_CAMERA_HEIGHT_M,
  );
  if (!point) return null;
  return projectToGeo({
    device,
    heading: device.heading,
    pose: ar,
    point,
    source: measured ? source : "ground_estimate",
    hitType: measured ? "GroundPlane" : null,
  });
}

/** Where the box's base sits on the photo, in the photo's pixels. */
export function basePixel(box: NormalizedBox, meta: CaptureMetadata) {
  return boxBasePoint(box, meta.intrinsics);
}

/** The asset's height from its box top and its ground point; null when unknown. */
export function heightOf(
  meta: CaptureMetadata,
  box: NormalizedBox,
  position: DetectionPosition | null | undefined,
): number | null {
  const { intrinsics } = meta;
  const pose = meta.ar ?? meta.sensor;
  if (!pose || !intrinsics.focalLengthPx || !position?.arPoint) return null;
  const top = {
    x: ((box.xmin + box.xmax) / 2) * intrinsics.width,
    y: box.ymin * intrinsics.height,
  };
  const ray = pixelRay(pose, intrinsics.focalLengthPx, intrinsics, top);
  // The sensor pose has the lens at the origin of its frame.
  const origin: Vec3 = meta.ar?.position ?? [0, 0, 0];
  return heightFromTopRay(origin, position.arPoint, ray);
}

/** The phone's own fix, when nothing better is known. */
export function devicePosition(meta: CaptureMetadata): DetectionPosition {
  const { device } = meta;
  return {
    latitude: device.latitude,
    longitude: device.longitude,
    altitude: device.altitude,
    distanceM: 0,
    slantDistanceM: 0,
    bearingDeg: device.heading ?? 0,
    accuracyM: device.accuracy,
    projectionErrorM: 0,
    source: "device",
    hitType: null,
    arPoint: null,
    rough: false,
  };
}

/**
 * Positions every detection of a photo: the live AR hit when the shutter got
 * one for that track, else the ground plane through its base pixel. Without
 * AR, the sensor attitude ranges each box by ground plane and typical size.
 */
export function placeDetections(
  meta: CaptureMetadata,
  detections: readonly CapturedDetection[],
  hits: ReadonlyMap<number, { hit: ArHit; source: PositionSource }> = new Map(),
): CapturedDetection[] {
  const { sensor } = meta;
  if (!meta.ar) {
    if (!sensor) return [...detections];
    return detections.map((d) => {
      const placed = placeWithSensors({
        device: meta.device,
        pose: sensor,
        intrinsics: meta.intrinsics,
        box: d.box,
        label: d.label,
      });
      return {
        ...d,
        position: placed?.position ?? null,
        heightM: placed?.heightM ?? null,
      };
    });
  }
  return detections.map((d) => {
    const live = hits.get(d.trackId);
    const position =
      (live ? placeFromHit(meta, live.hit, live.source) : null) ??
      placeFromPixel(meta, basePixel(d.box, meta), "ar_auto");
    return { ...d, position, heightM: heightOf(meta, d.box, position) };
  });
}
