import {
  CONFIDENCE,
  DETECTOR_INPUT_SIZE,
  DETECTOR_MODEL,
  labelsHiddenFor,
} from "@/constants/DetectorModel";
import {
  toFrameFraction,
  unrotateAndroidBox,
  type Size,
} from "@/helpers/detectionGeometry";
import {
  createTrackerState,
  updateTracks,
  visibleTracks,
  type Detection,
  type Track,
  type TrackerState,
} from "@/helpers/detectionTracker";
import type { CaptureCategory, CapturedDetection } from "@/types/Capture";
import { useCallback, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useObjectDetector } from "react-native-executorch";
import type { ImageBuffer } from "react-native-executorch/cv";
import { useFrameOutput, type Frame } from "react-native-vision-camera";
import { useResizer, type GPUFrame } from "react-native-vision-camera-resizer";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const IS_ANDROID = Platform.OS === "android";

let nextMountId = 1;

/**
 * Tracker state for the frame-processor thread. It lives in that runtime's
 * global, because objects captured by a worklet are copied into it and can't
 * be relied on to persist. A new mount id starts a fresh tracker.
 */
function trackerFor(mountId: number): TrackerState {
  "worklet";
  const g = globalThis as {
    __captureTracker?: { mountId: number; state: TrackerState };
  };
  if (g.__captureTracker?.mountId !== mountId) {
    g.__captureTracker = { mountId, state: createTrackerState() };
  }
  return g.__captureTracker.state;
}

export interface TrackLabel {
  trackId: number;
  label: string;
  /** Rounded to two decimals, for the box label. */
  confidence: number;
  /** 0.40–0.70: shown as "suggested" and needs a tap to accept later (§6.3). */
  suggested: boolean;
}

export type DetectorStatus = "loading" | "ready" | "unavailable";

export interface LiveDetection {
  frameOutput: ReturnType<typeof useFrameOutput>;
  /** Confirmed tracks, updated per inference without re-rendering React. */
  tracks: SharedValue<Track[]>;
  /** Changes only when a track appears, goes, relabels or changes confidence band. */
  trackLabels: TrackLabel[];
  /** Upright camera frame size, once the first frame has arrived. */
  frameSize: Size | null;
  status: DetectorStatus;
  /** Model download progress, 0–100. */
  downloadProgress: number;
  /** Time of the last inference, ms; null before the first. */
  inferenceMs: number | null;
  /** Current tracks as fractions of the frame, for storing with a photo. */
  snapshot: () => CapturedDetection[];
}

/**
 * Live on-device detection and tracking for the capture preview, after
 * react-native-executorch-gallery's realtime-object-detection screen: YUV
 * frames → GPU resizer (cover) → detectObjectsWorklet → SORT tracker, all on
 * the frame processor thread. Labels from other categories are dropped.
 */
export function useLiveDetection(
  category: CaptureCategory,
  enabled: boolean,
): LiveDetection {
  const detector = useObjectDetector(DETECTOR_MODEL);
  const { detectObjectsWorklet } = detector;
  const { resizer } = useResizer({
    ...DETECTOR_INPUT_SIZE,
    channelOrder: "rgb",
    dataType: "uint8",
    scaleMode: "cover",
    pixelLayout: "interleaved",
  });

  const hidden = useMemo(() => labelsHiddenFor(category), [category]);
  const [mountId] = useState(() => nextMountId++);
  const tracks = useSharedValue<Track[]>([]);
  const [trackLabels, setTrackLabels] = useState<TrackLabel[]>([]);
  const [frameSize, setFrameSize] = useState<Size | null>(null);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const labelsKey = useRef("");
  const frameSizeRef = useRef<Size | null>(null);

  const publish = useCallback(
    (next: Track[], size: Size, ms: number) => {
      tracks.value = next;
      // Whole milliseconds, so React only re-renders when the figure changes.
      setInferenceMs(Math.round(ms));
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
      const prev = frameSizeRef.current;
      if (!prev || prev.width !== size.width || prev.height !== size.height) {
        frameSizeRef.current = size;
        setFrameSize(size);
      }
    },
    [tracks],
  );

  const onFrame = useCallback(
    (frame: Frame) => {
      "worklet";
      if (!enabled || !resizer || !detectObjectsWorklet) {
        frame.dispose();
        return;
      }
      let resized: GPUFrame | undefined;
      try {
        const isSideways =
          frame.orientation === "left" || frame.orientation === "right";
        const size = isSideways
          ? { width: frame.height, height: frame.width }
          : { width: frame.width, height: frame.height };

        resized = resizer.resize(frame);
        const input: ImageBuffer = {
          data: new Uint8Array(resized.getPixelBuffer()),
          ...DETECTOR_INPUT_SIZE,
          format: "rgb",
          layout: "hwc",
        };
        const detections: Detection[] = [];
        const started = Date.now();
        const found = detectObjectsWorklet(input);
        const ms = Date.now() - started;
        for (const d of found) {
          if (hidden[d.label]) continue;
          detections.push({
            label: d.label,
            confidence: d.confidence,
            box: unrotateAndroidBox(
              d.box,
              DETECTOR_INPUT_SIZE,
              IS_ANDROID,
              isSideways,
            ),
          });
        }
        const next = visibleTracks(
          updateTracks(trackerFor(mountId), detections),
        );
        scheduleOnRN(publish, next, size, ms);
      } catch {
        // A failed frame is skipped; the next one retries.
      } finally {
        resized?.dispose();
        frame.dispose();
      }
    },
    [enabled, resizer, detectObjectsWorklet, hidden, mountId, publish],
  );

  const frameOutput = useFrameOutput({
    pixelFormat: "yuv",
    dropFramesWhileBusy: true,
    onFrame,
  });

  const snapshot = useCallback((): CapturedDetection[] => {
    const size = frameSizeRef.current;
    if (!size) return [];
    return tracks.value.map((t) => ({
      trackId: t.trackId,
      label: t.label,
      confidence: t.confidence,
      box: toFrameFraction(t.box, DETECTOR_INPUT_SIZE, size),
    }));
  }, [tracks]);

  const status: DetectorStatus = detector.error
    ? "unavailable"
    : detector.isReady
      ? "ready"
      : "loading";

  return {
    frameOutput,
    tracks,
    trackLabels,
    frameSize,
    status,
    downloadProgress: detector.downloadProgress,
    inferenceMs,
    snapshot,
  };
}
