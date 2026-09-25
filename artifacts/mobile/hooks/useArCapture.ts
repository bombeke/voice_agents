import {
  AR_DETECT_INTERVAL_MS,
  AR_RAYCAST_INTERVAL_MS,
} from "@/constants/Capture";
import {
  CONFIDENCE,
  DETECTOR_MODEL,
  DETECTOR_MODEL_NAME,
  labelsHiddenFor,
} from "@/constants/DetectorModel";
import {
  add,
  boxBasePoint,
  cameraHeightAbove,
  cross,
  focalFromProjection,
  normalize,
  pickGroundHit,
  projectToGeo,
  scale,
  toHitTestPoint,
  type ArHit,
  type ScreenPoint,
} from "@/helpers/arGeometry";
import { buildCaptureMetadata, intrinsicsOf } from "@/helpers/captureMetadata";
import type { Size } from "@/helpers/detectionGeometry";
import { placeDetections } from "@/helpers/detectionPlacement";
import {
  createTrackerState,
  updateTracks,
  visibleTracks,
  type Detection,
  type Track,
} from "@/helpers/detectionTracker";
import type { DetectorStatus, TrackLabel } from "@/hooks/useLiveDetection";
import {
  createArBridge,
  currentPose,
  projectedPoint,
  screenshotUri,
  type ArBridge,
} from "@/services/capture/ArBridge";
import { decodeToImageBuffer } from "@/services/capture/FrameDecoder";
import type {
  ArCameraPose,
  ArTrackingState,
  CaptureCategory,
  CaptureLocation,
  CaptureMetadata,
  CapturedDetection,
  DetectionPosition,
  GnssFix,
  NormalizedBox,
  PositionSource,
} from "@/types/Capture";
import { useSelector } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, PixelRatio, Platform } from "react-native";
import { useObjectDetector } from "react-native-executorch";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

/** Long side of the frame the detector sees; the model resizes it further. */
const DETECT_MAX_SIDE = 640;
/** Reused for every detector frame, so screenshots don't pile up. */
const DETECT_FRAME = "ar-detect-frame";
/**
 * Track id of an asset placed by tap with no detection under it. The tracker
 * counts up from 1; small negative ids are the dev mock's fake detections.
 */
export const MANUAL_TRACK_ID = -100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The asset the ground ray is locked on: the best track's base, or a tap. */
export interface ArTarget {
  /** MANUAL_TRACK_ID when the tap hit no box. */
  trackId: number;
  hit: ArHit;
  source: Extract<PositionSource, "ar_auto" | "ar_tap">;
  /** Horizontal distance from the lens when the ray hit, metres. */
  distanceM: number;
  /** Where the tap was, as fractions of the view (manual targets only). */
  tap?: ScreenPoint;
}

/** What the shutter needs from the GPS gate. */
export interface ShotContext {
  location: CaptureLocation;
  latest: GnssFix | null;
  heading: number | null;
}

export interface ArShot {
  path: string;
  detections: CapturedDetection[];
  metadata: CaptureMetadata;
}

export interface ArCapture {
  bridge: ArBridge;
  /** Tracks in detector-frame pixels, updated without re-rendering. */
  tracks: SharedValue<Track[]>;
  trackLabels: TrackLabel[];
  /** Size of the frame the detector saw (the view, scaled down). */
  frameSize: Size | null;
  status: DetectorStatus;
  downloadProgress: number;
  inferenceMs: number | null;
  tracking: ArTrackingState;
  target: ArTarget | null;
  /** "Place by tap": the next tap on the view sets the target. */
  placing: boolean;
  setPlacing: (on: boolean) => void;
  placeAt: (point: ScreenPoint) => Promise<boolean>;
  onViewport: (size: Size) => void;
  shoot: (ctx: ShotContext) => Promise<ArShot>;
}

/** The live position of the target, for the capture sheet. */
export function targetPosition(
  target: ArTarget | null,
  pose: ArCameraPose | null,
  location: CaptureLocation | null,
  heading: number | null,
): DetectionPosition | null {
  if (!target || !pose || !location || heading === null) return null;
  return projectToGeo({
    device: location,
    heading,
    pose,
    point: target.hit.position,
    source: target.source,
    hitType: target.hit.type,
  });
}

function toFraction(
  box: { xmin: number; ymin: number; xmax: number; ymax: number },
  frame: Size,
): NormalizedBox {
  const cx = (x: number) => Math.max(0, Math.min(1, x / frame.width));
  const cy = (y: number) => Math.max(0, Math.min(1, y / frame.height));
  return {
    xmin: cx(box.xmin),
    ymin: cy(box.ymin),
    xmax: cx(box.xmax),
    ymax: cy(box.ymax),
  };
}

function imageSize(uri: string): Promise<Size> {
  return new Promise((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject),
  );
}

/**
 * AR-first capture (ARCore on Android, ARKit on iOS via ViroReact). The AR
 * session owns the camera, because ARCore and VisionCamera can't share it.
 *
 * 1. Detection: the AR view is grabbed every AR_DETECT_INTERVAL_MS, decoded
 *    off the GL thread and run through the same executorch YOLO26n with
 *    `detectObjects` (async, so the UI and AR render loops never wait on it).
 *    One loop at a time: the next frame is grabbed only after the last result.
 * 2. Auto-raycast: the best track's box base goes through
 *    performARHitTestWithPoint; the first ground hit is the asset's foot.
 * 3. Manual fallback: with no track (or a wrong one), "Place by tap" sends
 *    the tapped point through the same raycast.
 * 4. Drift guard: nothing is ranged until tracking is NORMAL, i.e. ARCore
 *    has mapped the ground; the screen prompts the surveyor meanwhile.
 */
export function useArCapture(
  category: CaptureCategory,
  enabled: boolean,
): ArCapture {
  const detector = useObjectDetector(DETECTOR_MODEL);
  const { detectObjects, isReady } = detector;
  const [bridge] = useState(createArBridge);
  const tracking = useSelector(bridge.tracking$);
  const hidden = useMemo(() => labelsHiddenFor(category), [category]);

  const tracks = useSharedValue<Track[]>([]);
  const [trackLabels, setTrackLabels] = useState<TrackLabel[]>([]);
  const [frameSize, setFrameSize] = useState<Size | null>(null);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [target, setTarget] = useState<ArTarget | null>(null);
  const [placing, setPlacing] = useState(false);

  const labelsKey = useRef("");
  const frameRef = useRef<Size | null>(null);
  const viewport = useRef<Size>({ width: 0, height: 0 });
  const targetRef = useRef<ArTarget | null>(null);
  const inferenceRef = useRef<number | null>(null);

  const updateTarget = useCallback(
    (next: ArTarget | null) => {
      targetRef.current = next;
      setTarget(next);
      bridge.marker$.set(next?.hit.position ?? null);
    },
    [bridge],
  );

  const publish = useCallback(
    (next: Track[], size: Size, ms: number) => {
      tracks.value = next;
      inferenceRef.current = ms;
      setInferenceMs(ms);
      const labels = next.map((t) => ({
        trackId: t.trackId,
        label: t.label,
        confidence: Math.round(t.confidence * 100) / 100,
        suggested: t.confidence < CONFIDENCE.accepted,
      }));
      // Confidence in 0.05 steps, so the labels don't re-render every frame.
      const key = labels
        .map(
          (t) =>
            `${t.trackId}:${t.label}:${t.suggested}:${Math.round(t.confidence * 20)}`,
        )
        .join("|");
      if (key !== labelsKey.current) {
        labelsKey.current = key;
        setTrackLabels(labels);
      }
      const prev = frameRef.current;
      if (!prev || prev.width !== size.width || prev.height !== size.height) {
        frameRef.current = size;
        setFrameSize(size);
      }
    },
    [tracks],
  );

  /** Current tracks as fractions of the view. */
  const snapshot = useCallback((): CapturedDetection[] => {
    const size = frameRef.current;
    if (!size) return [];
    return tracks.value.map((t) => ({
      trackId: t.trackId,
      label: t.label,
      confidence: t.confidence,
      box: toFraction(t.box, size),
    }));
  }, [tracks]);

  /** Ground hit under a point of the view (dp); null when the ray finds none. */
  const hitTest = useCallback(
    async (point: ScreenPoint): Promise<ArHit | null> => {
      const { scene } = bridge;
      const pose = bridge.pose;
      if (!scene || !pose) return null;
      const px = toHitTestPoint(point, PixelRatio.get(), Platform.OS);
      const results = await scene.performARHitTestWithPoint(px.x, px.y);
      return pickGroundHit(results, pose.position);
    },
    [bridge],
  );

  // 1. Detection on the AR view.
  useEffect(() => {
    if (!enabled || !isReady || !detectObjects) return;
    let cancelled = false;
    const state = createTrackerState();
    (async () => {
      while (!cancelled) {
        const started = Date.now();
        try {
          const nav = bridge.navigator;
          if (nav && bridge.tracking$.peek() !== "unavailable") {
            const uri = screenshotUri(
              await nav.takeScreenshot(DETECT_FRAME, false),
            );
            const frame = uri
              ? await decodeToImageBuffer(uri, DETECT_MAX_SIDE)
              : null;
            if (frame && !cancelled) {
              const t0 = Date.now();
              const found = await detectObjects(frame);
              const ms = Date.now() - t0;
              const detections: Detection[] = [];
              for (const d of found) {
                if (hidden[d.label]) continue;
                detections.push({
                  label: d.label,
                  confidence: d.confidence,
                  box: d.box,
                });
              }
              if (!cancelled) {
                publish(
                  visibleTracks(updateTracks(state, detections)),
                  { width: frame.width, height: frame.height },
                  ms,
                );
              }
            }
          }
        } catch {
          // A failed frame is skipped; the next one retries.
        }
        await sleep(
          Math.max(16, AR_DETECT_INTERVAL_MS - (Date.now() - started)),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, isReady, detectObjects, bridge, hidden, publish]);

  // 2. Auto-raycast through the best track's base.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let busy = false;
    const timer = setInterval(async () => {
      if (busy || cancelled) return;
      if (targetRef.current?.source === "ar_tap") return;
      if (bridge.tracking$.peek() !== "normal") return;
      const best = snapshot()
        .filter((d) => d.confidence >= CONFIDENCE.hidden)
        .sort((a, b) => b.confidence - a.confidence)[0];
      if (!best) {
        if (targetRef.current) updateTarget(null);
        return;
      }
      busy = true;
      try {
        const hit = await hitTest(boxBasePoint(best.box, viewport.current));
        const pose = bridge.pose;
        if (cancelled) return;
        updateTarget(
          hit && pose
            ? {
                trackId: best.trackId,
                hit,
                source: "ar_auto",
                distanceM: Math.hypot(
                  hit.position[0] - pose.position[0],
                  hit.position[2] - pose.position[2],
                ),
              }
            : null,
        );
      } catch {
        // Keep the last target; the next tick retries.
      } finally {
        busy = false;
      }
    }, AR_RAYCAST_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, bridge, snapshot, hitTest, updateTarget]);

  // 3. Manual fallback: a tap sends its point through the same raycast.
  const placeAt = useCallback(
    async (point: ScreenPoint): Promise<boolean> => {
      setPlacing(false);
      const hit = await hitTest(point).catch(() => null);
      const pose = bridge.pose;
      if (!hit || !pose) return false;
      const view = viewport.current;
      const fx = view.width ? point.x / view.width : 0;
      const fy = view.height ? point.y / view.height : 0;
      const under = snapshot().find(
        (d) =>
          fx >= d.box.xmin &&
          fx <= d.box.xmax &&
          fy >= d.box.ymin &&
          fy <= d.box.ymax,
      );
      updateTarget({
        trackId: under?.trackId ?? MANUAL_TRACK_ID,
        hit,
        source: "ar_tap",
        distanceM: Math.hypot(
          hit.position[0] - pose.position[0],
          hit.position[2] - pose.position[2],
        ),
        tap: { x: fx, y: fy },
      });
      return true;
    },
    [bridge, hitTest, snapshot, updateTarget],
  );

  /** Focal length in the screenshot's pixels, from Viro's projection. */
  const focalPx = useCallback(
    async (pose: ArCameraPose, image: Size): Promise<number | null> => {
      const nav = bridge.navigator;
      if (!nav) return null;
      const OFFSET = 0.1;
      const forward = normalize(pose.forward);
      const right = normalize(cross(forward, normalize(pose.up)));
      const ahead = add(pose.position, forward);
      const [a, b] = await Promise.all([
        nav.project(ahead),
        nav.project(add(ahead, scale(right, OFFSET))),
      ]);
      const pa = projectedPoint(a);
      const pb = projectedPoint(b);
      const f = pa && pb ? focalFromProjection(pa, pb, OFFSET) : null;
      if (!f) return null;
      // project() works in physical pixels on Android and points on iOS.
      const viewPx =
        viewport.current.width *
        (Platform.OS === "android" ? PixelRatio.get() : 1);
      return viewPx > 0 ? (f * image.width) / viewPx : null;
    },
    [bridge],
  );

  const shoot = useCallback(
    async ({ location, latest, heading }: ShotContext): Promise<ArShot> => {
      const nav = bridge.navigator;
      const pose = currentPose(bridge);
      if (!nav) throw new Error("AR view is not ready");

      // Hit test every track's base while the view still shows them.
      const view = viewport.current;
      const current = targetRef.current;
      let detections = snapshot();
      const hits = new Map<number, { hit: ArHit; source: PositionSource }>();
      if (current) {
        hits.set(current.trackId, { hit: current.hit, source: current.source });
      }
      for (const d of detections) {
        if (hits.has(d.trackId)) continue;
        const hit = await hitTest(boxBasePoint(d.box, view)).catch(() => null);
        if (hit) hits.set(d.trackId, { hit, source: "ar_auto" });
      }
      if (current?.trackId === MANUAL_TRACK_ID && current.tap) {
        const { x, y } = current.tap;
        detections = [
          ...detections,
          {
            trackId: MANUAL_TRACK_ID,
            label: "asset",
            confidence: 1,
            manual: true,
            box: {
              xmin: Math.max(0, x - 0.03),
              xmax: Math.min(1, x + 0.03),
              ymin: Math.max(0, y - 0.15),
              ymax: y,
            },
          },
        ];
      }

      // The photo is the AR view without the ground ring.
      const marker = bridge.marker$.peek();
      bridge.marker$.set(null);
      await sleep(80);
      let path: string | null;
      try {
        path = screenshotUri(
          await nav.takeScreenshot(`capture-${Date.now()}`, false),
        );
      } finally {
        bridge.marker$.set(marker);
      }
      if (!path) throw new Error("AR screenshot failed");

      const size = await imageSize(
        path.includes("://") ? path : `file://${path}`,
      );
      const focal = pose ? await focalPx(pose, size).catch(() => null) : null;
      const ground = current?.hit ?? [...hits.values()][0]?.hit ?? null;
      const metadata = buildCaptureMetadata({
        engine: "ar",
        intrinsics: intrinsicsOf(size, focal),
        location,
        latest,
        heading,
        pose,
        cameraHeightM:
          pose && ground
            ? cameraHeightAbove(pose.position, ground.position)
            : null,
        model: DETECTOR_MODEL_NAME,
        inferenceMs: inferenceRef.current,
      });
      return {
        path,
        metadata,
        detections: pose
          ? placeDetections(metadata, detections, hits)
          : detections,
      };
    },
    [bridge, snapshot, hitTest, focalPx],
  );

  /** Entering "place by tap" drops an earlier tap so the new one replaces it. */
  const startPlacing = useCallback(
    (on: boolean) => {
      if (on && targetRef.current?.source === "ar_tap") updateTarget(null);
      setPlacing(on);
    },
    [updateTarget],
  );

  const onViewport = useCallback((size: Size) => {
    viewport.current = size;
  }, []);

  const status: DetectorStatus = detector.error
    ? "unavailable"
    : isReady
      ? "ready"
      : "loading";

  return {
    bridge,
    tracks,
    trackLabels,
    frameSize,
    status,
    downloadProgress: detector.downloadProgress,
    inferenceMs,
    tracking,
    target,
    placing,
    setPlacing: startPlacing,
    placeAt,
    onViewport,
    shoot,
  };
}
