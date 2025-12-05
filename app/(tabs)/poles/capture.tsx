import { PressableButton } from '@/components/PressableButton';
import { CONTENT_SPACING, CONTROL_BUTTON_SIZE, MAX_ZOOM_FACTOR, SAFE_AREA_PADDING, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/constants/Camera';
import { AnimatedCamera } from '@/hooks/AnimatedCamera';
import { useIsForeground } from '@/hooks/useIsForeground';
import { usePinchGesture } from '@/hooks/usePinchGesture';
import { usePreferredCameraDevice } from '@/hooks/usePreferredCameraDevice';
import CaptureButton from '@/views/CaptureButton';
import IonIcon from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, GestureResponderEvent, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
//import { Tensor, TensorflowModel, useTensorflowModel } from 'react-native-fast-tflite';
import Colors from '@/constants/Colors';
import { usePoleDetection } from '@/hooks/usePoleDetection';
import { useIsFocused } from '@react-navigation/core';
import { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import {
  Camera,
  CameraProps,
  CameraRuntimeError,
  PhotoFile,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useLocationPermission,
  useMicrophonePermission,
  VideoFile
} from 'react-native-vision-camera';
import { Button, YStack } from 'tamagui';

import { requestSavePermission } from '@/hooks/Helpers';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { impactAsync, ImpactFeedbackStyle, notificationAsync, NotificationFeedbackType } from 'expo-haptics';
import { Accuracy, getCurrentPositionAsync } from 'expo-location';
import { createAssetAsync } from 'expo-media-library';
import { Camera as CameraIcon } from 'lucide-react-native';


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
  const isFocussed = useIsFocused()
  
  const isForeground = useIsForeground()
  const isActive = isFocussed && isForeground

  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back')
  const [enableHdr, setEnableHdr] = useState(false)
  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [enableNightMode, setEnableNightMode] = useState(false)
  //const [cameraResults, setCameraResults] = useState<any[]>([]); 
  const { cameraResults, detections, frameProcessor } = usePoleDetection();
 const pulseAnim = useRef(new Animated.Value(1)).current;
 const [isCapturing, setIsCapturing] = useState<boolean>(false);


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

    const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.setValue(1);
  };


  const setIsPressingButton = useCallback((_isPressingButton: boolean) => {
      isPressingButton.value = _isPressingButton
      return isPressingButton;
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
      Alert.alert("Taking the Photo",`Initiate Capture${media}XX:${type}`);
      Alert.alert("Camera results:",`${cameraResults}`);
      return router.navigate('/poles/maps');
    },[router,cameraResults])

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
  

  useEffect(() => {
    requestPermission();
  }, []);

  const videoHdr = format?.supportsVideoHdr && enableHdr
  const photoHdr = format?.supportsPhotoHdr && enableHdr && !videoHdr
  const allowCameraLocationPermissions = async()=>{
    await requestPermission();
    // await requestLocationPermission();
    await location.requestPermission()
    return;
  }

  const handleCapture = async () => {
      if (!camera.current || isCapturing) return;
  
      if (Platform.OS !== 'web') {
        await impactAsync(ImpactFeedbackStyle.Heavy);
      }
  
      setIsCapturing(true);
      startPulse();
  
      try {
        const locationResult = await getCurrentPositionAsync({
          accuracy: Accuracy.High,
        });
        const photo = await camera.current.takePhoto({ flash });
            try {
              const hasPermission = await requestSavePermission()
              if (!hasPermission) {
                Alert.alert('Permission denied!', 'Camera does not have permission to save the media.')
                return
              }
              await createAssetAsync(`file:///${photo.path}`, 'photo')
            } 
            catch (e) {
              const message = e instanceof Error ? e.message : JSON.stringify(e)
              Alert.alert('Failed to save!', `An unexpected error occured while trying to save. ${message}`)
            }
       const detectionResult = { hasPole: true, confidence: 80 };
  
        console.log('[AI] Detection result:', detectionResult);
        console.log('[Camera] Photo captured:', photo.path);
        console.log('[Camera] Location:', locationResult.coords);

        let hasPole = false;
        let confidence = 0;
  
          const parsed = detectionResult;
          hasPole = parsed.hasPole === true;
          confidence = parsed.confidence || 0;
  
        if (hasPole) {
          /*await addPole({
            latitude: locationResult.coords.latitude,
            longitude: locationResult.coords.longitude,
            timestamp: Date.now(),
            imageUri: photo.uri,
            detectionConfidence: confidence,
          });*/
          
          if (Platform.OS !== 'web') {
            await notificationAsync(NotificationFeedbackType.Success);
          }
        } 
        else {
          //('No utility pole detected. Try again.');
          
          if (Platform.OS !== 'web') {
            await notificationAsync(NotificationFeedbackType.Warning);
          }
        }
  
        //setTimeout(() => setLastCapture(null), 3000);
      } 
      catch (error) {
        console.error('[Camera] Error capturing:', error);
        
        if (Platform.OS !== 'web') {
          await notificationAsync(NotificationFeedbackType.Error);
        }
        
        //setTimeout(() => setLastCapture(null), 3000);
      } 
      finally {
        setIsCapturing(false);
        stopPulse();
      }
    };

  if (!hasPermission) {
    return (
      <YStack justify="center" verticalAlign="center" flex={1} gap="$4">
      <View style={styles.permissionContainer}>
        <CameraIcon size={64} color={Colors.light.textSecondary} />
        <Text style={styles.permissionTitle}>Camera & Location Access</Text>
        <Text style={styles.permissionText}>
          We need camera and location permissions to detect and record utility poles.
        </Text>
        <Button
          style={styles.permissionButton}
          onPress={ allowCameraLocationPermissions}
        >
          <Text style={styles.permissionButtonText}>Grant Permissions</Text>
        </Button>
      </View>
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
                frameProcessor={frameProcessor}
                frameProcessorFps={10}
              />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.text}>Your phone does not have a Camera.</Text>
        </View>
      )}
      <View style={styles.topBar}>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, isCapturing && styles.statusDotActive]} />
          <Text style={styles.statusText}>
            {isCapturing ? 'Analyzing...' : 'Ready to detect'}
          </Text>
        </View>
      </View>
      <View style={styles.targetFrame}>
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />
        <Text style={styles.targetText}>Center pole in frame</Text>
      </View>
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
            <MaterialCommunityIcons name={enableHdr ? 'hdr' : 'hdr-off'} color="white" size={24} />
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
      {/* Overlay for bounding boxes */}
      <View style={styles.overlay}>
        {detections.map((detection) => (
          <View
            key={detection.id}
            style={[
              styles.boundingBox,
              {
                left: detection.box.x,
                top: detection.box.y,
                width: detection.box.width,
                height: detection.box.height,
              }
            ]}
          >
            <View style={styles.labelContainer}>
              <Text style={styles.label}>
                {detection.label} ({Math.round(detection.confidence * 100)}%)
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.bottomBar}>
        <View style={styles.captureButtonContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.captureButton, isCapturing && styles.captureButtonActive]}
              onPress={handleCapture}
              disabled={isCapturing} //|| isAddingPole}
              activeOpacity={0.8}
            >
              {isCapturing?// || isAddingPole ?
                (
                <ActivityIndicator size="large" color="#FFFFFF" />
              ) : (
                <CameraIcon size={32} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Text style={styles.instructionText}>
          Tap to capture and detect utility pole
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",

  },
  /*camera: {
    flex: 1,
  },*/
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00ff00',
    backgroundColor: 'transparent',
  },
  labelContainer: {
    position: 'absolute',
    top: -30,
    left: 0,
    backgroundColor: '#00ff00',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  label: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
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


    permissionContainer: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 32,
      backgroundColor: Colors.light.background,
    },
    permissionTitle: {
      fontSize: 24,
      fontWeight: '700' as const,
      color: Colors.light.text,
      marginTop: 24,
      textAlign: 'center' as const,
    },
    permissionText: {
      fontSize: 16,
      color: Colors.light.textSecondary,
      marginTop: 12,
      textAlign: 'center' as const,
      lineHeight: 24,
    },
    permissionButton: {
      marginTop: 32,
      backgroundColor: Colors.light.primary,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 12,
    },
    permissionButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600' as const,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    topBar: {
      padding: 16,
      alignItems: 'flex-start' as const,
    },
    statusIndicator: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.light.success,
      marginRight: 8,
    },
    statusDotActive: {
      backgroundColor: Colors.light.warning,
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600' as const,
    },
    targetFrame: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 40,
    },
    corner: {
      position: 'absolute' as const,
      width: 40,
      height: 40,
      borderColor: Colors.light.primary,
    },
    cornerTopLeft: {
      top: '20%',
      left: '15%',
      borderTopWidth: 4,
      borderLeftWidth: 4,
    },
    cornerTopRight: {
      top: '20%',
      right: '15%',
      borderTopWidth: 4,
      borderRightWidth: 4,
    },
    cornerBottomLeft: {
      bottom: '20%',
      left: '15%',
      borderBottomWidth: 4,
      borderLeftWidth: 4,
    },
    cornerBottomRight: {
      bottom: '20%',
      right: '15%',
      borderBottomWidth: 4,
      borderRightWidth: 4,
    },
    targetText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600' as const,
      textAlign: 'center' as const,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    captureNotification: {
      position: 'absolute' as const,
      top: 100,
      left: 20,
      right: 20,
      backgroundColor: Colors.light.danger,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      shadowColor: Colors.light.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    captureNotificationSuccess: {
      backgroundColor: Colors.light.success,
    },
    captureNotificationText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600' as const,
      marginLeft: 12,
      flex: 1,
    },
    bottomBar: {
      paddingBottom: 40,
      paddingTop: 20,
    },
    captureButtonContainer: {
      alignItems: 'center' as const,
      marginBottom: 16,
    },
    captureButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: Colors.light.primary,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      borderWidth: 4,
      borderColor: '#FFFFFF',
      shadowColor: Colors.light.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 8,
    },
    captureButtonActive: {
      backgroundColor: Colors.light.warning,
    },
    instructionText: {
      color: '#FFFFFF',
      fontSize: 14,
      textAlign: 'center' as const,
      fontWeight: '500' as const,
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
