import type { ArCameraPose, ArTrackingState, Vec3 } from "@/types/Capture";
import { observable, type Observable } from "@legendapp/state";

/** The slice of Viro's `arSceneNavigator` the capture screen calls. */
export interface ArNavigator {
  takeScreenshot: (
    fileName: string,
    saveToCameraRoll: boolean,
  ) => Promise<unknown>;
  project: (point: Vec3) => Promise<unknown>;
}

/** The slice of ViroARScene the capture screen calls. */
export interface ArSceneHandle {
  performARHitTestWithPoint: (x: number, y: number) => Promise<unknown>;
}

/**
 * Links the Viro scene (rendered by ViroARSceneNavigator, outside React's
 * normal prop flow) with the capture hooks. The camera pose arrives every
 * frame, so it is kept in a plain field instead of React state; the tracking
 * state and the ground marker change rarely and are observables.
 */
export interface ArBridge {
  scene: ArSceneHandle | null;
  navigator: ArNavigator | null;
  /** Latest pose from onCameraTransformUpdate, without the tracking state. */
  pose: Omit<ArCameraPose, "trackingState"> | null;
  tracking$: Observable<ArTrackingState>;
  /** Where the ring marking the asset's base is drawn; null hides it. */
  marker$: Observable<Vec3 | null>;
}

export function createArBridge(): ArBridge {
  return {
    scene: null,
    navigator: null,
    pose: null,
    tracking$: observable<ArTrackingState>("unavailable"),
    marker$: observable<Vec3 | null>(null),
  };
}

/** The latest pose with the tracking state it was sampled under. */
export function currentPose(bridge: ArBridge): ArCameraPose | null {
  const { pose } = bridge;
  return pose ? { ...pose, trackingState: bridge.tracking$.peek() } : null;
}

/** Viro's screenshot result is `{ success, url, errorCode }`. */
export function screenshotUri(result: unknown): string | null {
  const r = result as { success?: boolean; url?: unknown } | null;
  return r?.success && typeof r.url === "string" && r.url ? r.url : null;
}

/** Viro's project() result is `{ screenPosition: [x, y, z] }`. */
export function projectedPoint(
  result: unknown,
): { x: number; y: number } | null {
  const p = (result as { screenPosition?: unknown } | null)?.screenPosition;
  if (
    !Array.isArray(p) ||
    typeof p[0] !== "number" ||
    typeof p[1] !== "number"
  ) {
    return null;
  }
  return { x: p[0], y: p[1] };
}
