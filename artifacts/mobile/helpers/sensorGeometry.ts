import {
  BOX_EDGE_ERROR,
  CAMERA_HEIGHT_ERROR_M,
  DEFAULT_CAMERA_HEIGHT_M,
  SENSOR_HEADING_ERROR_DEG,
  SENSOR_NO_DECLINATION_ERROR_DEG,
  SENSOR_TILT_ERROR_DEG,
  TYPICAL_ASSET_HEIGHTS,
} from "@/constants/Capture";
import {
  boxBasePoint,
  cross,
  length,
  normalize,
  pitchRoll,
  pixelRay,
  projectToGeo,
  scale,
  wrapDegrees,
  type ScreenPoint,
} from "@/helpers/arGeometry";
import type {
  CameraIntrinsics,
  CaptureMetadata,
  DetectionPosition,
  NormalizedBox,
  SensorCameraPose,
  Vec3,
} from "@/types/Capture";

/**
 * Ranging without ARCore / ARKit, from the phone's own sensors.
 *
 * Attitude: gravity (accelerometer, low-passed) gives "up" in the phone's
 * frame and the magnetometer gives north; together they turn the lens and
 * the photo's axes into a frame pinned to true north (x east, y up, -z
 * north), the AR frame's axes with the lens at the origin. The shared ray
 * maths in arGeometry then works unchanged.
 *
 * Range, two independent ways, fused by inverse variance:
 * - ground plane: the ray through the box base meets flat ground a hand-held
 *   lens height below: D = h / tan(depression). Sensitive to tilt and to h.
 * - apparent size: an upright asset of typical height H spans the rays to
 *   its top and base: D = H / (tan e_top − tan e_base). Tilt cancels; the
 *   error is the spread of H for that class.
 * Pure functions only; useDeviceAttitude does the native calls.
 */

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Phone-frame axes that can be the upright photo's "up" (portrait, landscape). */
const PHOTO_UP_AXES: readonly Vec3[] = [
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
];

/** The back camera looks out of the back of the phone: -z in its frame. */
const LENS: Vec3 = [0, 0, -1];

export interface SensorReading {
  /** Gravity in the phone's frame (x right, y top, z out of the screen), pointing down. */
  gravity: Vec3;
  /** Magnetic field in the phone's frame, µT. */
  magnetic: Vec3;
  /** True minus magnetic north, degrees; null when unknown. */
  declinationDeg: number | null;
  timestamp: number;
}

/**
 * The lens pose from gravity and the magnetic field. Null when either is
 * missing or they are parallel (no horizontal field to find north from).
 */
export function cameraPoseFromSensors({
  gravity,
  magnetic,
  declinationDeg,
  timestamp,
}: SensorReading): SensorCameraPose | null {
  if (length(gravity) < 1e-3 || length(magnetic) < 1e-3) return null;
  const up = normalize(scale(gravity, -1));
  const eastRaw = cross(magnetic, up);
  if (length(eastRaw) < 1e-3 * length(magnetic)) return null;
  const east = normalize(eastRaw);
  const north = cross(up, east);

  // Magnetic → true north: turn the horizontal axes by the declination.
  const d = (declinationDeg ?? 0) * RAD;
  const toWorld = (v: Vec3): Vec3 => {
    const e = dot(v, east);
    const n = dot(v, north);
    const trueEast = e * Math.cos(d) + n * Math.sin(d);
    const trueNorth = -e * Math.sin(d) + n * Math.cos(d);
    return [trueEast, dot(v, up), -trueNorth];
  };

  // The photo is stored upright, so its "up" is the phone axis nearest the sky.
  const photoUp = PHOTO_UP_AXES.reduce((best, axis) =>
    dot(axis, up) > dot(best, up) ? axis : best,
  );
  const forward = toWorld(LENS);
  const imageUp = toWorld(photoUp);
  const { pitchDeg, rollDeg } = pitchRoll({ forward, up: imageUp });
  return {
    forward,
    up: imageUp,
    headingDeg: wrapDegrees(Math.atan2(forward[0], -forward[2]) * DEG),
    pitchDeg,
    rollDeg,
    trueNorth: declinationDeg !== null,
    timestamp,
  };
}

/** Typical height of an upright asset class, or null when none is known. */
export function typicalHeightFor(label: string) {
  const l = label.toLowerCase().replace(/[_-]/g, " ");
  return TYPICAL_ASSET_HEIGHTS.find((t) => l.includes(t.keyword)) ?? null;
}

export interface RangeEstimate {
  distanceM: number;
  sigmaM: number;
}

/** Inverse-variance mean; widened when the two disagree beyond their errors. */
export function fuseRanges(
  estimates: readonly (RangeEstimate | null)[],
): RangeEstimate | null {
  const valid = estimates.filter(
    (e): e is RangeEstimate => !!e && e.distanceM > 0 && e.sigmaM > 0,
  );
  if (valid.length === 0) return null;
  let weight = 0;
  let sum = 0;
  for (const e of valid) {
    const w = 1 / (e.sigmaM * e.sigmaM);
    weight += w;
    sum += w * e.distanceM;
  }
  const distanceM = sum / weight;
  let sigmaM = Math.sqrt(1 / weight);
  // Sloping ground or an unusual asset: the spread is the honest error.
  for (const e of valid) {
    sigmaM = Math.max(sigmaM, Math.abs(e.distanceM - distanceM));
  }
  return { distanceM, sigmaM };
}

/** Elevation of a ray above the horizon, radians. */
const elevation = (ray: Vec3) => Math.asin(Math.max(-1, Math.min(1, ray[1])));

/** A box edge on the frame border was cut off, so it isn't the asset's edge. */
const EDGE_MARGIN = 0.02;

export interface SensorPlacementInput {
  device: CaptureMetadata["device"];
  pose: SensorCameraPose;
  intrinsics: Pick<CameraIntrinsics, "width" | "height" | "focalLengthPx">;
  box: NormalizedBox;
  label: string;
  /** Lens height above the asset's base; defaults to a hand-held height. */
  cameraHeightM?: number;
}

export interface SensorPlacement {
  position: DetectionPosition;
  /** From the ground-plane range only, so the size prior can't feed back into it. */
  heightM: number | null;
  ground: RangeEstimate | null;
  size: RangeEstimate | null;
}

/**
 * The asset's position from one detection on a photo taken with the sensor
 * pose. Null without a focal length, or when neither range works (base cut
 * off and no size prior, or the base ray above the horizon).
 */
export function placeWithSensors({
  device,
  pose,
  intrinsics,
  box,
  label,
  cameraHeightM = DEFAULT_CAMERA_HEIGHT_M,
}: SensorPlacementInput): SensorPlacement | null {
  const focal = intrinsics.focalLengthPx;
  if (!focal) return null;
  const image = { width: intrinsics.width, height: intrinsics.height };
  const baseRay = pixelRay(pose, focal, image, boxBasePoint(box, image));
  const topRay = pixelRay(pose, focal, image, {
    x: ((box.xmin + box.xmax) / 2) * image.width,
    y: box.ymin * image.height,
  });
  const eBase = elevation(baseRay);
  const eTop = elevation(topRay);
  const baseVisible = box.ymax < 1 - EDGE_MARGIN;
  const topVisible = box.ymin > EDGE_MARGIN;

  // One sigma of a box edge as an angle, and of the tilt.
  const edgeRad =
    (BOX_EDGE_ERROR * (box.ymax - box.ymin) * image.height) / focal;
  const tiltRad = Math.hypot(SENSOR_TILT_ERROR_DEG * RAD, edgeRad);

  const h = cameraHeightM;
  // Below ~0.5° the ground ray is too flat to trust.
  const ground: RangeEstimate | null =
    baseVisible && eBase < -0.5 * RAD
      ? (() => {
          const d = h / Math.tan(-eBase);
          return {
            distanceM: d,
            sigmaM: Math.hypot(
              (d * CAMERA_HEIGHT_ERROR_M) / h,
              (tiltRad * (h * h + d * d)) / h,
            ),
          };
        })()
      : null;

  const typical = typicalHeightFor(label);
  const span = Math.tan(eTop) - Math.tan(eBase);
  const size: RangeEstimate | null =
    typical && baseVisible && topVisible && span > 1e-4
      ? (() => {
          const d = typical.heightM / span;
          // Tilt shifts both edges alike and cancels; only the edges count.
          const spanError = Math.SQRT2 * edgeRad;
          return {
            distanceM: d,
            sigmaM:
              d *
              Math.hypot(typical.sigmaM / typical.heightM, spanError / span),
          };
        })()
      : null;

  const range = fuseRanges([ground, size]);
  if (!range) return null;

  const horizontal = Math.hypot(baseRay[0], baseRay[2]);
  if (horizontal < 1e-6) return null;
  const d = range.distanceM;
  const point: Vec3 = [
    (baseRay[0] / horizontal) * d,
    Math.tan(eBase) * d,
    (baseRay[2] / horizontal) * d,
  ];
  const headingErrorDeg = pose.trueNorth
    ? SENSOR_HEADING_ERROR_DEG
    : Math.hypot(SENSOR_HEADING_ERROR_DEG, SENSOR_NO_DECLINATION_ERROR_DEG);
  const position = projectToGeo({
    device,
    heading: pose.headingDeg,
    pose: { position: [0, 0, 0], forward: pose.forward },
    point,
    source: "sensor",
    hitType: null,
    rangeErrorM: range.sigmaM,
    headingErrorDeg,
  });
  const heightM =
    ground && topVisible && span > 0 ? ground.distanceM * span : null;
  return { position, heightM, ground, size };
}

/**
 * A pixel the surveyor tapped as the asset's base → position, on flat ground
 * a hand-held height below the lens (no box, so no size prior).
 */
export function placePixelWithSensors(
  meta: Pick<CaptureMetadata, "device" | "intrinsics">,
  pose: SensorCameraPose,
  pixel: ScreenPoint,
): DetectionPosition | null {
  const { width, height } = meta.intrinsics;
  if (!width || !height) return null;
  // A zero-height box at the tap: only the ground range applies.
  const x = pixel.x / width;
  const y = pixel.y / height;
  return (
    placeWithSensors({
      device: meta.device,
      pose,
      intrinsics: meta.intrinsics,
      box: { xmin: x, xmax: x, ymin: y, ymax: y },
      label: "",
    })?.position ?? null
  );
}
