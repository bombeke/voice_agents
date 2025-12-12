import { PressableButton } from '@/components/PressableButton';
import { CONTENT_SPACING, CONTROL_BUTTON_SIZE, MAX_ZOOM_FACTOR, SAFE_AREA_PADDING, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/constants/Camera';
import Colors from '@/constants/Colors';
import { AnimatedCamera } from '@/hooks/AnimatedCamera';
import { useIsForeground } from '@/hooks/useIsForeground';
import { usePoleDetection } from '@/hooks/usePoleDetection';
import { usePreferredCameraDevice } from '@/hooks/usePreferredCameraDevice';
import CaptureButton from '@/views/CaptureButton';
import IonIcon from "@expo/vector-icons/Ionicons";
import { useIsFocused } from '@react-navigation/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
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

import { useUtilityStorePoles } from '@/providers/UtilityStoreProvider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Accuracy, getCurrentPositionAsync } from 'expo-location';
import { Camera as CameraIcon, Check, X } from 'lucide-react-native';


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

  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const [enableHdr, setEnableHdr] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [enableNightMode, setEnableNightMode] = useState(false);
  const { cameraResults, detections, frameProcessor } = usePoleDetection();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const { addPole } = useUtilityStorePoles();
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  //const { addPole } = useUtilityPoles();


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
  const minZoom = device?.minZoom ?? 1
  const maxZoom = Math.min(device?.maxZoom ?? 1, MAX_ZOOM_FACTOR)

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

  const onMediaCaptured = useCallback(async (media: PhotoFile | VideoFile, type: 'photo' | 'video') => {
      /*router.navigate({
        pathname: '/poles/media',
        params: { path: media.path, type: type },
      });
      */
      const locationResult = await getCurrentPositionAsync({
        accuracy: Accuracy.High,
      });

      setLastCapture("Starting data capture");
      await addPole({
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
        timestamp: Date.now(),
        imageUri: media.path,
        detectionConfidence: 80, //get confidence from AI detections
      });
      
      setLastCapture("Data captured.");
      return router.navigate('/poles/maps');
    },[router,cameraResults, addPole])

  const onFlipCameraPressed = useCallback(() => {
    setCameraPosition((p) => (p === 'back' ? 'front' : 'back'))
  }, [])
  
  const onFlashPressed = useCallback(() => {
    setFlash((f) => (f === 'off' ? 'on' : 'off'))
  }, [])

  useEffect(() => {
    zoom.value = device?.neutralZoom ?? 1
  }, [zoom, device?.neutralZoom])

  useEffect(() => {
    const f =
      format != null
        ? `(${format.photoWidth}x${format.photoHeight} photo / ${format.videoWidth}x${format.videoHeight}@${format.maxFps} video @ ${fps}fps)`
        : undefined
  }, [format, fps])

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
          onOutputOrientationChanged={(o: any ) => console.log(`Output orientation changed to ${o}!`)}
          onPreviewOrientationChanged={(o: any ) => console.log(`Preview orientation changed to ${o}!`)}
          onUIRotationChanged={(degrees: any) => console.log(`UI Rotation changed: ${degrees}°`)}
          format={format}
          fps={fps}
          photoHdr={photoHdr}
          videoHdr={videoHdr}
          photoQualityBalance="quality"
          lowLightBoost={device.supportsLowLightBoost || true}
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

      {/* Capture button wrapper ensures perfect centering above safe area */}
      <View style={styles.captureButtonWrapper}>
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
      </View>

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

        <PressableButton style={styles.button} onPress={() => router.navigate('/poles')}>
          <IonIcon name="settings-outline" color="white" size={24} />
        </PressableButton>

        <PressableButton style={styles.button} onPress={() => router.navigate('/poles/media')}>
          <IonIcon name="qr-code-outline" color="white" size={24} />
        </PressableButton>
      </View>

      {/* Overlay for bounding boxes */}
      <View style={styles.overlay} pointerEvents="none">
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
      {
        lastCapture && (
          <View
            style={[
              styles.captureNotification,
              lastCapture.includes('detected and saved') && styles.captureNotificationSuccess,
            ]}
          >
            {lastCapture.includes('detected and saved') ? (
              <Check size={20} color="#FFFFFF" />
            ) : (
              <X size={20} color="#FFFFFF" />
            )}
            <Text style={styles.captureNotificationText}>{lastCapture}</Text>
          </View>
        )
      }

    </View>
  );

}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // camera preview looks better on black
  },

  cameraContainer: StyleSheet.absoluteFillObject,

  /* Top status */
  topBar: {
    position: 'absolute',
    top: SAFE_AREA_PADDING.paddingTop + 8,
    left: SAFE_AREA_PADDING.paddingLeft ?? 16,
    right: SAFE_AREA_PADDING.paddingRight ?? 16,
    zIndex: 20,
    alignItems: 'flex-start',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
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
    fontWeight: '600',
  },

  /* Target frame centered */
  targetFrame: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    pointerEvents: 'none',
  },
  corner: {
    position: 'absolute',
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
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },

  /* Capture button wrapper - centers the button horizontally */
  captureButtonWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: SAFE_AREA_PADDING.paddingBottom + 12,
    alignItems: 'center',
    zIndex: 30,
    // ensure wrapper is not intercepting touches for other UI:
    pointerEvents: 'box-none',
  },

  /* Actual capture button style (no absolute positioning here) */
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
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

  /* Right side vertical button column */
  rightButtonRow: {
    position: 'absolute',
    right: SAFE_AREA_PADDING.paddingRight,
    top: SAFE_AREA_PADDING.paddingTop + 20,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'flex-start',
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

  /* Overlay (bounding boxes) */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
    pointerEvents: 'none',
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

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  text: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
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
});
