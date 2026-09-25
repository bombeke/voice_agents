import {
  AR_RELIABLE_RANGE_M,
  HEADING_ERROR_DEG,
  SENSOR_ROUGH_ERROR_M,
} from "@/constants/Capture";
import type {
  ArCameraPose,
  ArTrackingState,
  DetectionPosition,
  NormalizedBox,
  PositionSource,
  Vec3,
} from "@/types/Capture";

/**
 * Geometry for placing an asset from the AR session (ViroReact / ARCore).
 *
 * The AR frame is metric and gravity-aligned: x right, y up, and -z where the
 * camera looked when the session started. Its yaw is arbitrary, so the phone's
 * compass heading ties it to true north: the offset between the compass and
 * the camera's forward yaw in the AR frame rotates any AR offset into a
 * bearing. Pure functions only; the hooks do the native calls.
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

export const sub = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const add = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const scale = (a: Vec3, k: number): Vec3 => [
  a[0] * k,
  a[1] * k,
  a[2] * k,
];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l === 0 ? a : scale(a, 1 / l);
}

/** 0–360. */
export function wrapDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Where to aim the ground ray for a box (fix for "ray missing the horizon"):
 * the base of the box, not its centre. A ray through the middle of a pole
 * passes over the ground and never hits a plane; one through its foot meets
 * the ground where the pole stands. Nudged 2% of the box up so it lands on
 * the asset, not on whatever is behind it.
 */
export function boxBasePoint(
  box: NormalizedBox,
  view: { width: number; height: number },
): ScreenPoint {
  const height = box.ymax - box.ymin;
  return {
    x: ((box.xmin + box.xmax) / 2) * view.width,
    y: (box.ymax - height * 0.02) * view.height,
  };
}

/**
 * Viro's hit test takes physical pixels on Android (it builds an
 * android.graphics.Point from the ints) and points on iOS.
 */
export function toHitTestPoint(
  point: ScreenPoint,
  pixelRatio: number,
  os: string,
): ScreenPoint {
  const k = os === "android" ? pixelRatio : 1;
  return { x: Math.round(point.x * k), y: Math.round(point.y * k) };
}

/** Viro's ViroTrackingStateConstants: 1 unavailable, 2 limited, 3 normal. */
export function trackingStateFrom(state: number): ArTrackingState {
  if (state === 3) return "normal";
  if (state === 2) return "limited";
  return "unavailable";
}

export interface ArHit {
  type: string;
  position: Vec3;
}

/** Most trustworthy first: a bounded plane, depth, then weaker guesses. */
const HIT_RANK: Record<string, number> = {
  ExistingPlaneUsingExtent: 0,
  DepthPoint: 1,
  ExistingPlane: 2,
  EstimatedHorizontalPlane: 3,
  FeaturePoint: 4,
};

/** Relative range error of each hit type, as a fraction of the distance. */
const RANGE_ERROR: Record<string, number> = {
  ExistingPlaneUsingExtent: 0.03,
  DepthPoint: 0.05,
  ExistingPlane: 0.04,
  EstimatedHorizontalPlane: 0.08,
  FeaturePoint: 0.1,
  /** A ray through a photo onto the ground plane the AR session measured. */
  GroundPlane: 0.06,
};
const GROUND_ESTIMATE_ERROR = 0.15;

/**
 * The best ground hit from `performARHitTestWithPoint`: below the lens (the
 * ground, not a wall or the sky), ranked by type, nearest on a tie. Accepts
 * Viro's loosely typed results and skips anything malformed.
 */
export function pickGroundHit(results: unknown, camera: Vec3): ArHit | null {
  if (!Array.isArray(results)) return null;
  const hits: ArHit[] = [];
  for (const r of results) {
    const position = r?.transform?.position;
    if (
      !Array.isArray(position) ||
      position.length < 3 ||
      !position.every((n: unknown) => typeof n === "number" && isFinite(n))
    ) {
      continue;
    }
    if (position[1] >= camera[1]) continue;
    hits.push({
      type: String(r.type ?? "FeaturePoint"),
      position: position as Vec3,
    });
  }
  hits.sort(
    (a, b) =>
      (HIT_RANK[a.type] ?? 9) - (HIT_RANK[b.type] ?? 9) ||
      length(sub(a.position, camera)) - length(sub(b.position, camera)),
  );
  return hits[0] ?? null;
}

/** Yaw of a horizontal direction in the AR frame, clockwise from -z, degrees. */
function arYaw(v: Vec3): number {
  return Math.atan2(v[0], -v[2]) * DEG;
}

/** Camera pitch (+ looking up) and roll (+ right side down), degrees. */
export function pitchRoll(pose: Pick<ArCameraPose, "forward" | "up">) {
  const f = normalize(pose.forward);
  const right = normalize(cross(f, normalize(pose.up)));
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  return {
    pitchDeg: Math.asin(clamp(f[1])) * DEG,
    rollDeg: -Math.asin(clamp(right[1])) * DEG,
  };
}

/**
 * Focal length in pixels from two projected points one metre ahead of the
 * lens, `offsetM` apart sideways: f = screen distance / offset.
 */
export function focalFromProjection(
  ahead: ScreenPoint,
  aside: ScreenPoint,
  offsetM: number,
): number | null {
  const d = Math.hypot(aside.x - ahead.x, aside.y - ahead.y);
  return d > 0 && offsetM > 0 ? d / offsetM : null;
}

export function horizontalFov(width: number, focalPx: number | null) {
  return focalPx ? 2 * Math.atan(width / 2 / focalPx) * DEG : null;
}

/**
 * The ray through a pixel of a photo taken at `pose`, as a unit vector in
 * the AR frame. `focalPx` and the pixel are in the same image's pixels.
 */
export function pixelRay(
  pose: Pick<ArCameraPose, "forward" | "up">,
  focalPx: number,
  image: { width: number; height: number },
  pixel: ScreenPoint,
): Vec3 {
  const f = normalize(pose.forward);
  const up = normalize(pose.up);
  const right = normalize(cross(f, up));
  const dx = pixel.x - image.width / 2;
  const dy = pixel.y - image.height / 2;
  return normalize(
    add(add(scale(f, focalPx), scale(right, dx)), scale(up, -dy)),
  );
}

/**
 * Flat-ground fallback: where a ray from the lens meets a horizontal ground
 * `cameraHeightM` below it. Null when the ray doesn't point down.
 */
export function groundIntersection(
  origin: Vec3,
  ray: Vec3,
  cameraHeightM: number,
): Vec3 | null {
  if (ray[1] > -1e-3 || cameraHeightM <= 0) return null;
  const t = cameraHeightM / -ray[1];
  return add(origin, scale(ray, t));
}

/**
 * Height of an upright asset standing at `base`, from the ray through the top
 * of its box: the point on that ray at the base's horizontal distance.
 */
export function heightFromTopRay(
  origin: Vec3,
  base: Vec3,
  topRay: Vec3,
): number | null {
  const horizontal = Math.hypot(base[0] - origin[0], base[2] - origin[2]);
  const rayHorizontal = Math.hypot(topRay[0], topRay[2]);
  if (rayHorizontal < 1e-6 || horizontal <= 0) return null;
  const topY = origin[1] + topRay[1] * (horizontal / rayHorizontal);
  const height = topY - base[1];
  return height > 0 ? height : null;
}

/** Metres east/north of a point → latitude/longitude (flat earth, fine within a few km). */
export function offsetLatLon(
  latitude: number,
  longitude: number,
  east: number,
  north: number,
) {
  const lat = latitude * RAD;
  const mPerDegLat =
    111132.92 - 559.82 * Math.cos(2 * lat) + 1.175 * Math.cos(4 * lat);
  const mPerDegLon = 111412.84 * Math.cos(lat) - 93.5 * Math.cos(3 * lat);
  return {
    latitude: latitude + north / mPerDegLat,
    longitude: longitude + east / mPerDegLon,
  };
}

export interface ProjectInput {
  device: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
  };
  /** Compass heading of the camera, degrees from true north. */
  heading: number;
  pose: Pick<ArCameraPose, "position" | "forward">;
  /** The ground point in the AR frame. */
  point: Vec3;
  source: PositionSource;
  hitType: string | null;
  /** One sigma of the range, metres; defaults to the hit type's share of it. */
  rangeErrorM?: number;
  /** One sigma of the compass; defaults to HEADING_ERROR_DEG. */
  headingErrorDeg?: number;
}

/**
 * The asset's latitude/longitude from an AR ground point: its offset from the
 * lens, turned to true north with the compass, added to the phone's fix.
 * Accuracy adds the fix, the range error of the hit type and the sideways
 * error of the compass in quadrature.
 */
export function projectToGeo({
  device,
  heading,
  pose,
  point,
  source,
  hitType,
  rangeErrorM,
  headingErrorDeg = HEADING_ERROR_DEG,
}: ProjectInput): DetectionPosition {
  const offset = sub(point, pose.position);
  const distanceM = Math.hypot(offset[0], offset[2]);
  const northOffset = heading - arYaw(pose.forward);
  const bearingDeg = wrapDegrees(arYaw(offset) + northOffset);
  const east = distanceM * Math.sin(bearingDeg * RAD);
  const north = distanceM * Math.cos(bearingDeg * RAD);
  const { latitude, longitude } = offsetLatLon(
    device.latitude,
    device.longitude,
    east,
    north,
  );
  const relative =
    source === "ground_estimate"
      ? GROUND_ESTIMATE_ERROR
      : (RANGE_ERROR[hitType ?? ""] ?? 0.1);
  const projectionErrorM = Math.hypot(
    rangeErrorM ?? distanceM * relative,
    distanceM * Math.sin(headingErrorDeg * RAD),
  );
  return {
    latitude,
    longitude,
    altitude: device.altitude === null ? null : device.altitude + offset[1],
    distanceM,
    slantDistanceM: length(offset),
    bearingDeg,
    accuracyM:
      device.accuracy === null
        ? null
        : Math.hypot(device.accuracy, projectionErrorM),
    projectionErrorM,
    source,
    hitType,
    arPoint: point,
    rough:
      source === "ground_estimate" ||
      distanceM > AR_RELIABLE_RANGE_M ||
      (source === "sensor" && projectionErrorM > SENSOR_ROUGH_ERROR_M),
  };
}

/** The lens height above an AR ground point, metres. */
export function cameraHeightAbove(camera: Vec3, ground: Vec3): number {
  return camera[1] - ground[1];
}
