
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CameraDevice } from "react-native-vision-camera";
import {
  Camera,
  Frame,
  useCameraDevices,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput
} from "react-native-vision-camera";
import { scheduleOnRN } from "react-native-worklets";

import { useCameraController } from "@/hooks/useCameraController";
import { prepareAndInitializeModel } from "@/services/PrepareModel";
import { Dimensions } from "react-native";
import {
  Bbox,
  Detection,
  ObjectDetectionModelSources,
  ObjectDetectionModule,
  ObjectDetectionOptions,
  ObjectDetectionProps,
  ObjectDetectionType,
  PixelData
} from 'react-native-executorch';

import { MODEL_DETECTION_CONFIG, YOLO26N } from "@/constants/Config";
import { CocoLabelYolo } from "@/constants/Enum";
import { Track, TrackedDetection } from "@/hooks/Types";
import { useModuleFactory } from "@/hooks/useModuleFactory";
import {
  useLocation
} from 'react-native-vision-camera-location';
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
  onChange?: (values: {
    selectedTag: string | "";
    comment: string | "";
  }) => void;
  detections?: any;
  error?: string;
}

let TRACKS: Track[] = [];
let NEXT_ID = 1;

export const iou=(a: Bbox, b: Bbox)=> {
  'worklet';
  const xA = Math.max(a.x1, b.x1);
  const yA = Math.max(a.y1, b.y1);
  const xB = Math.min(a.x2, b.x2);
  const yB = Math.min(a.y2, b.y2);

  const inter = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);

  return inter / (areaA + areaB - inter + 1e-6);
}

// simple Kalman-like prediction (constant velocity)
export const predict =(track: Track)=>{
  'worklet';
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
}

function updateVelocity(prev: Track, det:  Detection<typeof CocoLabelYolo>) {
  'worklet';
  const dx = det.bbox.x1 - prev.bbox.x1;
  const dy = det.bbox.y1 - prev.bbox.y1;

  // smoothing factor (reduces jitter)
  const alpha = 0.7;

  return {
    vx: alpha * dx + (1 - alpha) * prev.vx,
    vy: alpha * dy + (1 - alpha) * prev.vy,
  };
}

export const trackSORT=(detections:  Detection<typeof CocoLabelYolo>[])=> {
  'worklet';

  let predicted: Track[] = TRACKS.map(predict);

  const updated: Track[] = [];

  detections.forEach((det) => {
    let best: Track | null = null;
    let bestScore = 0;

    predicted.forEach((track: Track ) => {
      if (track.label !== det.label) return;

      const score = iou(track.bbox, det.bbox);
      if (score > bestScore) {
        bestScore = score;
        best = track;
      }
    });

    if (best && best !== null && bestScore > 0.3) {
      const vel = updateVelocity(best, det);
      const matched  = best as Track;
      updated.push({
        trackId: matched.trackId,
        bbox: det.bbox,
        vx: vel.vx,
        vy: vel.vy,
        hits: matched.hits + 1,
        age: 0,
        label: matched.label,
        score: det.score
      });
    }
    else {
      updated.push({
        trackId: NEXT_ID++,
        bbox: det.bbox,
        vx: 0,
        vy: 0,
        age: 0,
        hits: 1,
        label: det.label,
        score: det.score
      });
    }
  });

  predicted.forEach((track) => {
    const stillExists = updated.find((t) => t.trackId === track.trackId);
    if (!stillExists && track.age < 5) {
      updated.push(track);
    }
  });

  TRACKS = updated;

  return updated;
}
/**
 * React hook for managing an Object Detection model instance.
 * @typeParam C - A {@link ObjectDetectionModelSources} config specifying which built-in model to load.
 * @category Hooks
 * @param props - Configuration object containing `model` config and optional `preventLoad` flag.
 * @returns An object with model state (`error`, `isReady`, `isGenerating`, `downloadProgress`) and typed `forward` and `runOnFrame` functions.
 */
export const useTagObjectDetection = <C extends ObjectDetectionModelSources>({
  model,
  preventLoad = false,
}: ObjectDetectionProps<C>): ObjectDetectionType<
  typeof CocoLabelYolo
> => {
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
    //const exposure = useSharedValue(2);
    const location = useLocation()
    const devices = useCameraDevices()
    const device = useMemo(() => devices.find((d: CameraDevice ) => d.position === 'back'),[devices]);
    const [flash] = useState<"off" | "on">("off");
    const [modelPath, setModelPath] = useState<string | null>(null);

    const photoOutput = usePhotoOutput({});
    const { takePhoto } = useCameraController({photoOutput});
    const model = useTagObjectDetection({ model: YOLO26N });
    const [detections, setDetections] = useState<TrackedDetection[]>([]);
    const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });

    const detRof = model.runOnFrame;

    const updateDetections = useCallback((results: TrackedDetection[]) => {
      setDetections(results);
    }, []);
    

    const frameOutput = useFrameOutput({
      pixelFormat: 'rgb',
      dropFramesWhileBusy: true,
      onFrame: useCallback(
        (frame: Frame) => {
          'worklet';
          try {
            if (!detRof || !model.isReady) return;
            const isFrontCamera = false; // using back camera
            const result = detRof(frame, isFrontCamera, { detectionThreshold: 0.5 });
            scheduleOnRN(setFrameSize, {
              width: frame.width,
              height: frame.height,
            });
            if (Array.isArray(result) && result.length > 0) {
              const tracked = trackSORT(result);
              scheduleOnRN(updateDetections, tracked);
            } 
            else {
              scheduleOnRN(updateDetections, []);
            }
          } 
          finally {
            frame.dispose();
          }
        },
        [detRof, updateDetections,setFrameSize, model.isReady]
      ),
    });
    const handleCapture = async () => {
      await takePhoto({ flashMode: flash, detections })
    };

    useEffect(() => {
      (async () => {
        const path = await prepareAndInitializeModel();
        setModelPath(path);
      })();
    }, []);

    useEffect(() => {
      if (!location.hasPermission) {
        location.requestPermission()
      }
    }, [location.hasPermission])
    
  
    useEffect(() => {
      if (!hasPermission) requestPermission();
    }, [hasPermission,requestPermission]);
  
  
    const allowCameraLocationPermissions = useCallback(
      async () => { 
        await requestPermission(); 
        await location.requestPermission();
        return; 
    },[requestPermission,location]);
  

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
            device= "back"
            isActive={ true }
            outputs={[frameOutput, photoOutput]}
            enableNativeZoomGesture={ true }
            enableNativeTapToFocusGesture={ true }
            orientationSource="device"
            enableLowLightBoost ={ true }
          />
        </View>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}>
          {(detections ?? []).map((det, i) => {
            const { x1, y1, x2, y2 } = det.bbox;
            const screenRatio = screenHeight / screenWidth;
            const frameRatio = frameSize.height / frameSize.width;
            let offsetY = 0;
            let offsetX = 0;

            if (frameRatio > screenRatio) {
              const scaledHeight = frameSize.height * (screenWidth / frameSize.width);
              offsetY = (scaledHeight - screenHeight) / 2;

            }
            else {
              const scaledWidth = frameSize.width * (screenHeight / frameSize.height);
              offsetX = (scaledWidth - screenWidth) / 2;
            }
            const scaleX = screenWidth / frameSize.height;
            const scaleY = screenHeight / frameSize.width;
            const left = y1 * scaleX;
            const top = x1 * scaleY;

            const width = (y2 - y1) * scaleX;
            const height = (x2 - x1) * scaleY;

            return (
              <View
                key={i}
                style={[
                  styles.box,
                  {
                    left: y1,
                    top: x1,
                    width: y2-y1,
                    height: x2-x1,
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
        <CameraControls
          onCapture={handleCapture}
          disabled={ false }
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    //backgroundColor: "#000", // Ensures preview always has visible base
  },
  formContainer: {
    padding: 16,
    backgroundColor: "#fff",
    zIndex: 10,
  },
  cameraWrapper: {
    flex: 1,
    //backgroundColor: "#000", // Forces preview background visible
    overflow: "hidden",
  },
  label: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    color: 'white',
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
