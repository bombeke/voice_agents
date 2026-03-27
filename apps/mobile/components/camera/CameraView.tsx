
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
  SSDLITE_320_MOBILENET_V3_LARGE,
  useObjectDetection,
} from 'react-native-executorch';
//import { useSharedValue } from "react-native-reanimated";
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

export const CameraView = memo(({ form, onChange }: Props) => {
    const ready = useAppReady();
    const { hasPermission, requestPermission } = useCameraPermission();
    //const exposure = useSharedValue(2);
    const location = useLocation()
    const devices = useCameraDevices()
    const device = useMemo(() => devices.find((d: CameraDevice ) => d.position === 'back'),[devices]);
    console.log("devices:",devices,"device:",device)
    const [flash] = useState<"off" | "on">("off");
    const [modelPath, setModelPath] = useState<string | null>(null);

    const photoOutput = usePhotoOutput({});
    const { takePhoto } = useCameraController({photoOutput});
    const model = useObjectDetection({ model: SSDLITE_320_MOBILENET_V3_LARGE });
    const [detections, setDetections] = useState<Detection[]>([]);
    const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });

    const detRof = model.runOnFrame;

    const updateDetections = useCallback((results: Detection[]) => {
      setDetections(results);
    }, []);

    const frameOutput = useFrameOutput({
      pixelFormat: 'rgb',
      dropFramesWhileBusy: true,
      onFrame: useCallback(
        (frame: Frame) => {
          'worklet';
          try {
            if (!detRof) return;
            const isFrontCamera = false; // using back camera
            const result = detRof(frame, isFrontCamera, 0.5);
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
        [detRof, updateDetections,setFrameSize]
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
            const top = (frameSize.width - x2) * scaleY;

            const width = (y2 - y1) * scaleX;
            const height = (x2 - x1) * scaleY;
             console.log("FrameSize:",frameSize, "Screen:",{height:screenHeight,width: screenWidth},"boundingBox style:",{
                    left,
                    top,
                    width,
                    height,
                  }, "scale:",[scaleX,scaleY])
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
