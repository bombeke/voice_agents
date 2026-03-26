
import { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Camera,
  Frame,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput
} from "react-native-vision-camera";
import { scheduleOnRN } from "react-native-worklets";

import { useCameraController } from "@/hooks/useCameraController";
import { prepareAndInitializeModel } from "@/services/PrepareModel";
import {
  Detection,
  SSDLITE_320_MOBILENET_V3_LARGE,
  useObjectDetection,
} from 'react-native-executorch';
import {
  useLocation
} from 'react-native-vision-camera-location';
import { useAppReady } from "../AppReadyContext";
import { CameraControls } from "./CameraControl";
import { NoCameraDevice } from "./NoCameraDevice";
import { PermissionsPage } from "./PermissionsPage";

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

export const CameraView = memo(
  ({ form, onChange }: Props) => {
    const ready = useAppReady();
    const { hasPermission, requestPermission } = useCameraPermission();
    const location = useLocation()
    const device = useCameraDevice('back');
    const [flash] = useState<"off" | "on">("off");
    const [modelPath, setModelPath] = useState<string | null>(null);

    const photoOutput = usePhotoOutput();
    const { isInitialized, isCapturing, takePhoto } = useCameraController({photoOutput});
    const model = useObjectDetection({ model: SSDLITE_320_MOBILENET_V3_LARGE });
    const [detections, setDetections] = useState<Detection[]>([]);

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
            if (result) {
              scheduleOnRN(updateDetections, result);
            }
          } 
          finally {
            frame.dispose();
          }
        },
        [detRof, updateDetections]
      ),
    });
    const handleCapture = async () => {
      if (!isInitialized || isCapturing) return;
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
        <Camera
          style={StyleSheet.absoluteFill}
          device= {device}
          isActive={ true}
          outputs={[frameOutput]}
          orientationSource="device"
        />
        {detections.map((det, i) => (
          <Text key={i} style={styles.label}>
            {det.label} {(det.score * 100).toFixed(1)}%
          </Text>
        ))}
        <CameraControls
          onCapture={handleCapture}
          disabled={!isInitialized || isCapturing}
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
    backgroundColor: "#000", // Forces preview background visible
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
});
