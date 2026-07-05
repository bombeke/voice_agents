import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import type { CameraDevice } from "react-native-vision-camera";
import {
  Camera,
  Frame,
  useCameraDevices,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput,
} from "react-native-vision-camera";
import { scheduleOnRN } from "react-native-worklets";
import { useSharedValue } from "react-native-worklets-core";

import { useCameraController } from "@/hooks/useCameraController";
import { prepareAndInitializeModel } from "@/services/PrepareModel";
import {
  Bbox,
  Detection,
  ObjectDetectionModelSources,
  ObjectDetectionModule,
  ObjectDetectionOptions,
  ObjectDetectionProps,
  ObjectDetectionType,
  PixelData,
} from "react-native-executorch";

import { MODEL_DETECTION_CONFIG, YOLO26N } from "@/constants/Config";
import { CocoLabelYolo } from "@/constants/Enum";
import { Track, TrackedDetection } from "@/hooks/Types";
import { useModuleFactory } from "@/hooks/useModuleFactory";
import { useLocation } from "react-native-vision-camera-location";
import { useAppReady } from "../AppReadyContext";
import { CameraControls } from "./CameraControl";
import { NoCameraDevice } from "./NoCameraDevice";
import { PermissionsPage } from "./PermissionsPage";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export interface Props {
  device?: any;
  isActive?: boolean;
  form?: {
    selectedTag?: string;
    comment?: string;
  };
  onChange?: (values: { selectedTag: string | ""; comment: string | "" }) => void;
  detections?: any;
  error?: string;
}

/**
 * Tracker state is held in a plain object that is passed BY REFERENCE into the
 * worklet. Module-level `let TRACKS` was shared across every mount and mutated
 * from the frame-processor thread, causing races/stale state. We keep the state
 * on a single object created per-mount and only mutate it inside the worklet.
 */
type TrackerState = { tracks: Track[]; nextId: number };

export const iou = (a: Bbox, b: Bbox) => {
  "worklet";
  const xA = Math.max(a.x1, b.x1);
  const yA = Math.max(a.y1, b.y1);
  const xB = Math.min(a.x2, b.x2);
  const yB = Math.min(a.y2, b.y2);

  const inter = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);

  return inter / (areaA + areaB - inter + 1e-6);
};

// simple constant-velocity prediction
export const predict = (track: Track): Track => {
  "worklet";
  return {
    ...track,
    bbox: {
      x1: track.bbox.x1 + track.vx,
      y1: track.bbox.y1 + track.vy,
      x2: track.bbox.x2 + track.vx,
      y2: track.bbox.y2 + track.vy,
    },
    age: track.age + 1,
  };
};

function updateVelocity(prev: Track, det: Detection<typeof CocoLabelYolo>) {
  "worklet";
  const dx = det.bbox.x1 - prev.bbox.x1;
  const dy = det.bbox.y1 - prev.bbox.y1;

  // smoothing factor (reduces jitter)
  const alpha = 0.7;

  return {
    vx: alpha * dx + (1 - alpha) * prev.vx,
    vy: alpha * dy + (1 - alpha) * prev.vy,
  };
}

export const trackSORT = (
  state: TrackerState,
  detections: Detection<typeof CocoLabelYolo>[]
): Track[] => {
  "worklet";

  const predicted: Track[] = state.tracks.map(predict);
  const updated: Track[] = [];
  const usedTrackIds: number[] = [];

  detections.forEach((det) => {
    let best: Track | null = null;
    let bestScore = 0;

    predicted.forEach((track: Track) => {
      if (track.label !== det.label) return;
      if (usedTrackIds.indexOf(track.trackId) !== -1) return; // one det per track

      const score = iou(track.bbox, det.bbox);
      if (score > bestScore) {
        bestScore = score;
        best = track;
      }
    });

    if (best !== null && bestScore > 0.3) {
      const matched = best as Track;
      const vel = updateVelocity(matched, det);
      usedTrackIds.push(matched.trackId);
      updated.push({
        trackId: matched.trackId,
        bbox: det.bbox,
        vx: vel.vx,
        vy: vel.vy,
        hits: matched.hits + 1,
        age: 0,
        label: matched.label,
        score: det.score,
      });
    } else {
      updated.push({
        trackId: state.nextId++,
        bbox: det.bbox,
        vx: 0,
        vy: 0,
        age: 0,
        hits: 1,
        label: det.label,
        score: det.score,
      });
    }
  });

  // keep recently-lost tracks alive briefly (coast on prediction)
  predicted.forEach((track) => {
    const stillExists = updated.find((t) => t.trackId === track.trackId);
    if (!stillExists && track.age < 5) {
      updated.push(track);
    }
  });

  state.tracks = updated;
  return updated;
};

export const useTagObjectDetection = <C extends ObjectDetectionModelSources>({
  model,
  preventLoad = false,
}: ObjectDetectionProps<C>): ObjectDetectionType<typeof CocoLabelYolo> => {
  const {
    error,
    isReady,
    isGenerating,
    downloadProgress,
    runForward,
    runOnFrame,
    instance,
  } = useModuleFactory({
    factory: (modelSource, config, onProgress) =>
      ObjectDetectionModule.fromCustomModel(modelSource, config, onProgress),
    modelSource: model?.modelSource,
    config: MODEL_DETECTION_CONFIG,
    deps: [model.modelName, model.modelSource],
    preventLoad,
  });

  const forward = (
    input: string | PixelData,
    options?: ObjectDetectionOptions<typeof CocoLabelYolo>
  ) => runForward((inst) => inst.forward(input, options));

  const getAvailableInputSizes = () =>
    instance?.getAvailableInputSizes() ?? undefined;

  return {
    error,
    isReady,
    isGenerating,
    downloadProgress,
    forward,
    runOnFrame,
    getAvailableInputSizes,
  };
};

export const CameraView = memo(({ form, onChange }: Props) => {
  const ready = useAppReady();
  const { hasPermission, requestPermission } = useCameraPermission();
  const location = useLocation();
  const devices = useCameraDevices();
  const device = useMemo(
    () => devices.find((d: CameraDevice) => d.position === "back"),
    [devices]
  );
  const [flash] = useState<"off" | "on">("off");
  const [modelPath, setModelPath] = useState<string | null>(null);

  const photoOutput = usePhotoOutput({});
  const { takePhoto } = useCameraController({ photoOutput });
  const model = useTagObjectDetection({ model: YOLO26N });
  const [detections, setDetections] = useState<TrackedDetection[]>([]);
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });

  const detRof = model.runOnFrame;

  // Per-mount tracker state that is safe to mutate inside the worklet.
  const trackerState = useSharedValue<TrackerState>({ tracks: [], nextId: 1 });

  const updateDetections = useCallback((results: TrackedDetection[]) => {
    setDetections(results);
  }, []);

  const frameOutput = useFrameOutput({
    pixelFormat: "rgb",
    dropFramesWhileBusy: true,
    onFrame: useCallback(
      (frame: Frame) => {
        "worklet";
        try {
          if (!detRof || !model.isReady) return;
          const isFrontCamera = false; // using back camera
          const result = detRof(frame, isFrontCamera, {
            detectionThreshold: 0.5,
          });

          scheduleOnRN(setFrameSize, {
            width: frame.width,
            height: frame.height,
          });

          if (Array.isArray(result) && result.length > 0) {
            const tracked = trackSORT(trackerState.value, result);
            // send hits>=2 to reduce flicker; drop the filter if you want raw
            scheduleOnRN(updateDetections, tracked as TrackedDetection[]);
          } else {
            scheduleOnRN(updateDetections, []);
          }
        } finally {
          frame.dispose();
        }
      },
      [detRof, updateDetections, model.isReady, trackerState]
    ),
  });

  const handleCapture = async () => {
    await takePhoto({ flashMode: flash, detections });
  };

  useEffect(() => {
    (async () => {
      const path = await prepareAndInitializeModel();
      setModelPath(path);
    })();
  }, []);

  useEffect(() => {
    if (!location.hasPermission) {
      location.requestPermission();
    }
  }, [location.hasPermission]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const allowCameraLocationPermissions = useCallback(async () => {
    await requestPermission();
    await location.requestPermission();
    return;
  }, [requestPermission, location]);

  if (!ready || !modelPath) return null;

  if (!hasPermission)
    return (
      <PermissionsPage
        allowCameraLocationPermissions={allowCameraLocationPermissions}
      />
    );

  if (!device) return <NoCameraDevice />;

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          outputs={[frameOutput, photoOutput]}
          enableNativeZoomGesture={true}
          enableNativeTapToFocusGesture={true}
          orientationSource="device"
          enableLowLightBoost={true}
        />
      </View>

      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}
        pointerEvents="none"
      >
        {(detections ?? []).map((det, i) => {
          const box = mapBboxToScreen(det.bbox, frameSize);
          return (
            <View
              key={det.trackId ?? i}
              style={[
                styles.box,
                {
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height,
                },
              ]}
            >
              <Text style={styles.boxLabel}>
                #{det.trackId} {det.label} {(det.score * 100).toFixed(1)}%
              </Text>
            </View>
          );
        })}
      </View>

      <CameraControls onCapture={handleCapture} disabled={false} />
    </View>
  );
});

/**
 * Maps a detection bbox (in the model input frame's pixel space) onto the
 * on-screen preview using an aspect-fill ("cover") transform — matching how
 * VisionCamera's preview fills the view.
 *
 * The preview is portrait but the frame buffer arrives landscape, so the
 * frame's width maps to the screen's HEIGHT and vice-versa. We compute a single
 * `scale` (the larger of the two ratios, = cover) and center-crop offsets, then
 * clamp the result so boxes never spill off-screen.
 */
function mapBboxToScreen(
  bbox: Bbox,
  frameSize: { width: number; height: number }
) {
  // Buffer is landscape; portrait preview swaps the axes.
  const srcW = frameSize.height; // frame height -> screen X extent
  const srcH = frameSize.width; // frame width  -> screen Y extent

  // "cover" scale: fill the screen, cropping the overflow axis.
  const scale = Math.max(screenWidth / srcW, screenHeight / srcH);

  const displayedW = srcW * scale;
  const displayedH = srcH * scale;

  const offsetX = (displayedW - screenWidth) / 2;
  const offsetY = (displayedH - screenHeight) / 2;

  // Axis swap: model x -> screen y, model y -> screen x.
  let left = bbox.y1 * scale - offsetX;
  let top = bbox.x1 * scale - offsetY;
  let right = bbox.y2 * scale - offsetX;
  let bottom = bbox.x2 * scale - offsetY;

  // Clamp to screen so the box fits and hugs the object edge.
  left = Math.max(0, Math.min(left, screenWidth));
  top = Math.max(0, Math.min(top, screenHeight));
  right = Math.max(0, Math.min(right, screenWidth));
  bottom = Math.max(0, Math.min(bottom, screenHeight));

  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
    backgroundColor: "#fff",
    zIndex: 10,
  },
  cameraWrapper: {
    flex: 1,
    overflow: "hidden",
  },
  label: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    color: "white",
    fontSize: 16,
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
  },
  error: {
    color: "red",
    marginTop: 8,
    fontWeight: "500",
  },
  box: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "red",
    justifyContent: "flex-start",
  },
  boxLabel: {
    position: "absolute",
    top: -22,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});