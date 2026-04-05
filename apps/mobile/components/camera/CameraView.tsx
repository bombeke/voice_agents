
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
  Detection,
  ObjectDetectionConfig,
  ObjectDetectionModelSources,
  ObjectDetectionModule,
  ObjectDetectionOptions,
  ObjectDetectionProps,
  ObjectDetectionType,
  PixelData
} from 'react-native-executorch';

import { useModuleFactory } from "@/hooks/useModuleFactory";
import {
  useLocation
} from 'react-native-vision-camera-location';
import { useAppReady } from "../AppReadyContext";
import { CameraControls } from "./CameraControl";
import { NoCameraDevice } from "./NoCameraDevice";
import { PermissionsPage } from "./PermissionsPage";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface Props {
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
export const URL_PREFIX ='https://huggingface.co/software-mansion/react-native-executorch';
export const VERSION_TAG = 'resolve/v0.8.0';
const YOLO26N_DETECTION_MODEL = `${URL_PREFIX}-yolo26/${VERSION_TAG}/yolo26n/xnnpack/yolo26n.pte`;

export const YOLO26N = {
  modelName: 'yolo26n',
  //modelSource: YOLO26N_DETECTION_MODEL,
  modelSource: require("../assets/model.pte")
} as any;
 
export interface InferInterface {
  modelName: string;
  modelSource?: string;
}

export enum CocoLabelYolo {
  PERSON = 0,
  BICYCLE = 1,
  CAR = 2,
  MOTORCYCLE = 3,
  AIRPLANE = 4,
  BUS = 5,
  TRAIN = 6,
  TRUCK = 7,
  BOAT = 8,
  TRAFFIC_LIGHT = 9,
  FIRE_HYDRANT = 10,
  STOP_SIGN = 11,
  PARKING_METER = 12,
  BENCH = 13,
  BIRD = 14,
  CAT = 15,
  DOG = 16,
  HORSE = 17,
  SHEEP = 18,
  COW = 19,
  ELEPHANT = 20,
  BEAR = 21,
  ZEBRA = 22,
  GIRAFFE = 23,
  BACKPACK = 24,
  UMBRELLA = 25,
  HANDBAG = 26,
  TIE = 27,
  SUITCASE = 28,
  FRISBEE = 29,
  SKIS = 30,
  SNOWBOARD = 31,
  SPORTS_BALL = 32,
  KITE = 33,
  BASEBALL_BAT = 34,
  BASEBALL_GLOVE = 35,
  SKATEBOARD = 36,
  SURFBOARD = 37,
  TENNIS_RACKET = 38,
  BOTTLE = 39,
  WINE_GLASS = 40,
  CUP = 41,
  FORK = 42,
  KNIFE = 43,
  SPOON = 44,
  BOWL = 45,
  BANANA = 46,
  APPLE = 47,
  SANDWICH = 48,
  ORANGE = 49,
  BROCCOLI = 50,
  CARROT = 51,
  HOT_DOG = 52,
  PIZZA = 53,
  DONUT = 54,
  CAKE = 55,
  CHAIR = 56,
  COUCH = 57,
  POTTED_PLANT = 58,
  BED = 59,
  DINING_TABLE = 60,
  TOILET = 61,
  TV = 62,
  LAPTOP = 63,
  MOUSE = 64,
  REMOTE = 65,
  KEYBOARD = 66,
  CELL_PHONE = 67,
  MICROWAVE = 68,
  OVEN = 69,
  TOASTER = 70,
  SINK = 71,
  REFRIGERATOR = 72,
  BOOK = 73,
  CLOCK = 74,
  VASE = 75,
  SCISSORS = 76,
  TEDDY_BEAR = 77,
  HAIR_DRIER = 78,
  TOOTHBRUSH = 79,
}

const MODEL_DETECTION_CONFIG = {
  labelMap: CocoLabelYolo,
  preprocessorConfig: undefined,
  availableInputSizes: [384, 512, 640] as const,
  defaultInputSize: 384,
  defaultDetectionThreshold: 0.5,
  defaultIouThreshold: 0.5,
} satisfies ObjectDetectionConfig<typeof CocoLabelYolo>;

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
    console.log("Model:::",model)
    const [detections, setDetections] = useState<Detection<typeof CocoLabelYolo>[]>([]);
    const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });

    const detRof = model.runOnFrame;

    const updateDetections = useCallback((results: Detection<typeof CocoLabelYolo>[]) => {
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
            console.log("DeTS:",result)
            scheduleOnRN(setFrameSize, {
              width: frame.width,
              height: frame.height,
            });
            if (Array.isArray(result) && result.length > 0) {
              scheduleOnRN(updateDetections, result);
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
      await takePhoto({ flashMode: flash })
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
            /*const scaleX = screenWidth / frameSize.width;
            const scaleY = screenHeight / frameSize.height;

            const left = x1 * scaleX;
            const top = y1 * scaleY;
            const width = (x2 - x1) * scaleX;
            const height = (y2 - y1) * scaleY;
            */
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
                    left,
                    top,
                    width,
                    height,
                  },
                ]}
              >
                <Text style={styles.boxLabel}>
                  {det.label} {(det.score * 100).toFixed(1)}%
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
