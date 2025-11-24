import { PressableButton } from '@/components/PressableButton';
import { CONTENT_SPACING, CONTROL_BUTTON_SIZE, MAX_ZOOM_FACTOR, SAFE_AREA_PADDING, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/constants/Camera';
import { AnimatedCamera } from '@/hooks/AnimatedCamera';
import { useIsForeground } from '@/hooks/useIsForeground';
import { usePinchGesture } from '@/hooks/usePinchGesture';
import { usePreferredCameraDevice } from '@/hooks/usePreferredCameraDevice';
import CaptureButton from '@/views/CaptureButton';
import IonIcon from "@expo/vector-icons/Ionicons";
import MaterialIcon from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureResponderEvent, StyleSheet, Text, View } from "react-native";
//import { Tensor, TensorflowModel, useTensorflowModel } from 'react-native-fast-tflite';
import Reanimated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import {
  Camera,
  CameraProps,
  CameraRuntimeError,
  PhotoFile,
  runAtTargetFps,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
  useLocationPermission,
  useMicrophonePermission,
  VideoFile
} from 'react-native-vision-camera';
import { Button, YStack } from 'tamagui';
import { useResizePlugin } from "vision-camera-resize-plugin";

const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera)
Reanimated.addWhitelistedNativeProps({
  zoom: true,
})

/*
function tensorToString(tensor: Tensor): string {
  return `\n  - ${tensor.dataType} ${tensor.name}[${tensor.shape}]`
}
function modelToString(model: TensorflowModel): string {
  return (
    `TFLite Model (${model.delegate}):\n` +
    `- Inputs: ${model.inputs.map(tensorToString).join('')}\n` +
    `- Outputs: ${model.outputs.map(tensorToString).join('')}`
  )
}*/

 export default function CameraPage(): React.ReactElement {
  const camera = useRef<Camera>(null)
  const [isCameraInitialized, setIsCameraInitialized] = useState(false)
  const microphone = useMicrophonePermission()
  const { hasPermission, requestPermission } = useCameraPermission()
  const location = useLocationPermission()
  const zoom = useSharedValue(1)
  const isPressingButton = useSharedValue(false)
  const router = useRouter();
  const params = useLocalSearchParams<{ path?: string; type?: 'photo' | 'video' }>();
  const [isFocussed,setIsFocused] = useState<boolean>(false);

  // check if camera page is active
  useFocusEffect(
    useCallback(() => {
      console.log('Screen is focused');
      setIsFocused(true)
      return () => {
        setIsFocused(false)
        console.log('Screen is unfocused');
      };
    }, [])
  );
  const isForeground = useIsForeground()
  const isActive = isFocussed && isForeground

  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back')
  const [enableHdr, setEnableHdr] = useState(false)
  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [enableNightMode, setEnableNightMode] = useState(false)
  const [cameraResults, setCameraResults] = useState<any[]>([]);

  // camera device settings
  const [preferredDevice] = usePreferredCameraDevice()
  let device = useCameraDevice(cameraPosition)

  if (preferredDevice != null && preferredDevice.position === cameraPosition) {
    // override default device with the one selected by the user in settings
    device = preferredDevice
  }

  const [targetFps, setTargetFps] = useState(60)

  const screenAspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH
  const format = useCameraFormat(device, [
    { fps: targetFps },
    { videoAspectRatio: screenAspectRatio },
    { videoResolution: 'max' },
    { photoAspectRatio: screenAspectRatio },
    { photoResolution: 'max' },
  ])

  const fps = Math.min(format?.maxFps ?? 1, targetFps)

  const supportsFlash = device?.hasFlash ?? false
  const supportsHdr = format?.supportsPhotoHdr
  const supports60Fps = useMemo(() => device?.formats.some((f) => f.maxFps >= 60), [device?.formats])
  const canToggleNightMode = device?.supportsLowLightBoost ?? false

  //#region Animated Zoom
  const minZoom = device?.minZoom ?? 1
  const maxZoom = Math.min(device?.maxZoom ?? 1, MAX_ZOOM_FACTOR)
  const pinchGesture = usePinchGesture(zoom, minZoom, maxZoom);

  const cameraAnimatedProps = useAnimatedProps<CameraProps>(() => {
    const z = Math.max(Math.min(zoom.value, maxZoom), minZoom)
    return {
      zoom: z,
    }
  }, [maxZoom, minZoom, zoom])
  //#endregion

  //#region Callbacks
  const setIsPressingButton = useCallback((_isPressingButton: boolean) => {
      isPressingButton.value = _isPressingButton
    },[isPressingButton])

  const onError = useCallback((error: CameraRuntimeError) => {
    console.error(error)
  }, [])

  const onInitialized = useCallback(() => {
    setIsCameraInitialized(true)
  }, [])

  const onMediaCaptured = useCallback((media: PhotoFile | VideoFile, type: 'photo' | 'video') => {
      /*router.navigate({
        pathname: '/poles/media',
        params: { path: media.path, type: type },
      });
      */
      if(isCameraInitialized){
        console.log("Camera_media called:",media,'type:',type);
        return router.navigate('/poles/media');
      }
    },[isCameraInitialized])
  const onFlipCameraPressed = useCallback(() => {
    setCameraPosition((p) => (p === 'back' ? 'front' : 'back'))
  }, [])
  
  const onFlashPressed = useCallback(() => {
    setFlash((f) => (f === 'off' ? 'on' : 'off'))
  }, [])
  //#endregion

  //#region Tap Gesture
  const onFocusTap = useCallback(
    ({ nativeEvent: event }: GestureResponderEvent) => {
      if (!device?.supportsFocus) return
      camera.current?.focus({
        x: event.locationX,
        y: event.locationY,
      })
    },
    [device?.supportsFocus],
  )
  const onDoubleTap = useCallback(() => {
    onFlipCameraPressed()
  }, [onFlipCameraPressed])
  //#endregion

  //#region Effects
  useEffect(() => {
    // Reset zoom to it's default everytime the `device` changes.
    zoom.value = device?.neutralZoom ?? 1
  }, [zoom, device])
  //#endregion


  useEffect(() => {
    const f =
      format != null
        ? `(${format.photoWidth}x${format.photoHeight} photo / ${format.videoWidth}x${format.videoHeight}@${format.maxFps} video @ ${fps}fps)`
        : undefined
    console.log(`Camera: ${device?.name} | Format: ${f}`)
  }, [device?.name, format, fps])

  useEffect(() => {
    location.requestPermission()
  }, [location])
  
  
  /*const model = useTensorflowModel(require('../../../assets/yolo11n_float16.tflite'))
  const actualModel = model.state === 'loaded' ? model.model : undefined

  useEffect(() => {
    if (actualModel == null) return
    console.log(`Model loaded! Shape:\n${modelToString(actualModel)}]`)
  }, [actualModel])
  */
  useEffect(() => {
    requestPermission();
  }, []);


  const { resize } = useResizePlugin()
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'
   /* if (actualModel == null) {
      // model is still loading...
      return
    }*/
    runAtTargetFps(5, () => {
      'worklet'
      console.log(`${frame.timestamp}: ${frame.width}x${frame.height} ${frame.pixelFormat} Frame (${frame.orientation})`)
      const resized = resize(frame, {
        scale: {
          width: 320,
          height: 320,
        },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      })
      /*const result = actualModel.runSync([resized])
      setCameraResults(result);
      const num_detections = result[3]?.[0] ?? 0
      console.log('Result: ' + num_detections)*/
    })
  }, [])

  const videoHdr = format?.supportsVideoHdr && enableHdr
  const photoHdr = format?.supportsPhotoHdr && enableHdr && !videoHdr


  if (!hasPermission) {
    return (
      <YStack justify="center" verticalAlign="center" flex={1} gap="$4">
        <Text>Camera permission is required</Text>
        <Button onPress={requestPermission}>Grant Permission</Button>
      </YStack>
    );
  }
  return (
    <View style={styles.container}>
      {device != null ? (
              <AnimatedCamera
                style={styles.cameraContainer}
                device={device}
                isActive={isActive}
                ref={camera}
                onInitialized={onInitialized}
                onError={onError}
                onStarted={() => console.log('Camera started!')}
                onStopped={() => console.log('Camera stopped!')}
                onPreviewStarted={() => console.log('Preview started!')}
                onPreviewStopped={() => console.log('Preview stopped!')}
                onOutputOrientationChanged={(o) => console.log(`Output orientation changed to ${o}!`)}
                onPreviewOrientationChanged={(o) => console.log(`Preview orientation changed to ${o}!`)}
                onUIRotationChanged={(degrees) => console.log(`UI Rotation changed: ${degrees}°`)}
                format={format}
                fps={fps}
                photoHdr={photoHdr}
                videoHdr={videoHdr}
                photoQualityBalance="quality"
                //lowLightBoost={device.supportsLowLightBoost && enableNightMode}
                lowLightBoost={device.supportsLowLightBoost || true }
                enableZoomGesture={false}
                animatedProps={cameraAnimatedProps}
                exposure={5}
                enableFpsGraph={true}
                outputOrientation="device"
                photo={true}
                video={true}
                audio={microphone.hasPermission}
                enableLocation={location.hasPermission}
                //frameProcessor={frameProcessor}
              />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.text}>Your phone does not have a Camera.</Text>
        </View>
      )}

      <CaptureButton
        style={styles.captureButton}
        camera={camera as any}
        onMediaCaptured={onMediaCaptured}
        cameraZoom={zoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        flash={supportsFlash ? flash : 'off'}
        enabled={isCameraInitialized && isActive}
        setIsPressingButton={setIsPressingButton}
      />

      {
        //<StatusBarBlurBackground /> 
      }

      <View style={styles.rightButtonRow}>
        <PressableButton style={styles.button} onPress={onFlipCameraPressed} disabledOpacity={0.4}>
          <IonIcon name="camera-reverse" color="white" size={24} />
        </PressableButton>
        {supportsFlash && (
          <PressableButton style={styles.button} onPress={onFlashPressed} disabledOpacity={0.4}>
            <IonIcon name={flash === 'on' ? 'flash' : 'flash-off'} color="white" size={24} />
          </PressableButton>
        )}
        {supports60Fps && (
          <PressableButton style={styles.button} onPress={() => setTargetFps((t) => (t === 30 ? 60 : 30))}>
            <Text style={styles.text}>{`${targetFps}\nFPS`}</Text>
          </PressableButton>
        )}
        {supportsHdr && (
          <PressableButton style={styles.button} onPress={() => setEnableHdr((h) => !h)}>
            <MaterialIcon name={enableHdr ? 'hdr' : 'hdr-off'} color="white" size={24} />
          </PressableButton>
        )}
        {canToggleNightMode && (
          <PressableButton style={styles.button} onPress={() => setEnableNightMode(!enableNightMode)} disabledOpacity={0.4}>
            <IonIcon name={enableNightMode ? 'moon' : 'moon-outline'} color="white" size={24} />
          </PressableButton>
        )}
        <PressableButton style={styles.button} onPress={
          () => router.navigate('/poles') //router.navigate('Devices')
          }>
          <IonIcon name="settings-outline" color="white" size={24} />
        </PressableButton>
        <PressableButton style={styles.button} onPress={() => router.navigate('/poles/media')
         //router.navigate('CodeScannerPage')
          
         }>
          <IonIcon name="qr-code-outline" color="white" size={24} />
        </PressableButton>
      </View>
      <View>
        { cameraResults }
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  captureButton: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: SAFE_AREA_PADDING.paddingBottom,
  },
  button: {
    marginBottom: CONTENT_SPACING,
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    borderRadius: CONTROL_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(140, 140, 140, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightButtonRow: {
    position: 'absolute',
    right: SAFE_AREA_PADDING.paddingRight,
    top: SAFE_AREA_PADDING.paddingTop,
  },
  text: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: StyleSheet.absoluteFillObject,
  camera: StyleSheet.absoluteFillObject,
  shutterContainer: {
    position: "absolute",
    bottom: 44,
    left: 0,
    width: "100%",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 30,
  },
  shutterBtn: {
    backgroundColor: "transparent",
    borderWidth: 5,
    borderColor: "white",
    width: 85,
    height: 85,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterBtnInner: {
    width: 70,
    height: 70,
    borderRadius: 50,
  },

})



/*
export const CapturePoles =()=> {
  const [permission, requestPermission] = useCameraPermissions();
  const ref = useRef<CameraView>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [mode, setMode] = useState<CameraMode>("picture");
  const [facing, setFacing] = useState<CameraType>("back");
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detections, setDetections] = useState<any[]>([]);

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: "center" }}>
          We need your permission to use the camera
        </Text>
        <Button onPress={requestPermission} title="Grant permission" />
      </View>
    );
  }

  const takePicture = async () => {
    const photo = await ref.current?.takePictureAsync();
    if (photo?.uri) {
        setUri(photo.uri);
        simulateDetect();
    }
  };

  const recordVideo = async () => {
    if (recording) {
      setRecording(false);
      ref.current?.stopRecording();
      return;
    }
    setRecording(true);
    const video = await ref.current?.recordAsync();
    console.log({ video });
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "picture" ? "video" : "picture"));
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };
  const simulateDetect = async () => {
    setLoading(true);
    // Simulated ML detection: just fake bounding boxes
    await new Promise((r) => setTimeout(r, 800));
    setDetections([
      { id: "p1", score: 0.93, bbox: [50, 80, 120, 240] },
      { id: "p2", score: 0.78, bbox: [180, 60, 90, 200] },
    ]);
    setLoading(false);
    alert("Detected " + 2 + " poles (simulated)");
  };
  const renderPicture = (uri: string) => {
    return (
      <View>
        <Image
          source={{ uri }}
          contentFit="contain"
          style={{ width: 300, aspectRatio: 1 }}
        />
        <Button onPress={() => setUri(null)} title="Take another picture" />
      </View>
    );
  };

  const renderCamera = () => {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          ref={ref}
          mode={mode}
          facing={facing}
          mute={false}
          responsiveOrientationWhenOrientationLocked
        />
        <View style={styles.shutterContainer}>
          <Pressable onPress={toggleMode}>
            {mode === "picture" ? (
              <AntDesign name="picture" size={32} color="white" />
            ) : (
              <Feather name="video" size={32} color="white" />
            )}
          </Pressable>
          <Pressable onPress={mode === "picture" ? takePicture : recordVideo}>
            {({ pressed }) => (
              <View
                style={[
                  styles.shutterBtn,
                  {
                    opacity: pressed ? 0.5 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.shutterBtnInner,
                    {
                      backgroundColor: mode === "picture" ? "white" : "red",
                    },
                  ]}
                />
              </View>
            )}
          </Pressable>
          <Pressable onPress={toggleFacing}>
            <FontAwesome6 name="rotate-left" size={32} color="white" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {uri ? renderPicture(uri) : renderCamera()}
      {detections.length > 0 && (
        <View className="mt-4">
        <Text className="font-semibold">Detections (simulated)</Text>
        {detections.map((d) => (
        <Text key={d.id}>Pole {d.id} — score: {Math.round(d.score * 100)}%</Text>
        ))}
        </View>
        )}
    </View>
  );
}

function useResizePlugin(): { resize: any; } {
  throw new Error('Function not implemented.');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraContainer: StyleSheet.absoluteFillObject,
  camera: StyleSheet.absoluteFillObject,
  shutterContainer: {
    position: "absolute",
    bottom: 44,
    left: 0,
    width: "100%",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 30,
  },
  shutterBtn: {
    backgroundColor: "transparent",
    borderWidth: 5,
    borderColor: "white",
    width: 85,
    height: 85,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterBtnInner: {
    width: 70,
    height: 70,
    borderRadius: 50,
  },
});
*/
