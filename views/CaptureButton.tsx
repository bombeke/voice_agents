import { CAPTURE_BUTTON_SIZE } from '@/constants/Camera';
import React, { useCallback, useRef } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Reanimated, {
  cancelAnimation,
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { type Camera, type PhotoFile, type VideoFile } from 'react-native-vision-camera';

const START_RECORDING_DELAY = 200;
const BORDER_WIDTH = CAPTURE_BUTTON_SIZE * 0.1;

export interface CaptureButtonProps extends ViewProps {
  camera: React.RefObject<Camera> | null;
  onMediaCaptured: (media: PhotoFile | VideoFile, type: 'photo' | 'video') => void;
  minZoom: number;
  maxZoom: number;
  cameraZoom: any;
  flash: 'off' | 'on';
  enabled: boolean;
  setIsPressingButton: (isPressingButton: boolean) => void;
}

const CaptureButton: React.FC<CaptureButtonProps> = ({
  camera,
  onMediaCaptured,
  minZoom,
  maxZoom,
  cameraZoom,
  flash,
  enabled,
  setIsPressingButton,
  style,
  ...props
}) => {
  const pressDownDate = useRef<Date | undefined>(undefined);
  const isRecording = useRef(false);

  const recordingProgress = useSharedValue(0);
  const isPressingButton = useSharedValue(false);
  //const device = useCameraDevice('back')
  //const zoom = useSharedValue(device?.neutralZoom)

  //#region Capture Logic
  const takePhoto = useCallback(async () => {
    if (camera?.current == null) throw new Error('Camera ref is null!');
    const photo = await camera.current.takePhoto({ flash, enableShutterSound: false });
    onMediaCaptured(photo, 'photo');
  }, [camera, flash, onMediaCaptured]);

  const stopRecording = useCallback(async () => {
    if (camera?.current == null) throw new Error('Camera ref is null!');
    await camera.current.stopRecording();
    isRecording.current = false;
    cancelAnimation(recordingProgress);
  }, [camera, recordingProgress]);

  const startRecording = useCallback(() => {
    if (camera?.current == null) throw new Error('Camera ref is null!');
    camera.current.startRecording({
      flash,
      onRecordingError: (error) => console.error('Recording failed!', error),
      onRecordingFinished: (video) => {
        onMediaCaptured(video, 'video');
        isRecording.current = false;
      },
    });
    isRecording.current = true;
  }, [camera, flash, onMediaCaptured]);
  //#endregion

  //#region Tap Gesture
  const tapGesture = Gesture.Tap()
    .enabled(enabled)
    .maxDuration(9999999)
    .onStart(() => {
      const now = new Date();
      pressDownDate.current = now;
      isPressingButton.value = true;
      recordingProgress.value = 0;
      runOnJS(setIsPressingButton)(true);

      setTimeout(() => {
        if (pressDownDate.current === now) {
          runOnJS(startRecording)();
        }
      }, START_RECORDING_DELAY);
    })
    .onEnd(async () => {
      const diff = new Date().getTime() - (pressDownDate.current?.getTime() || 0);
      pressDownDate.current = undefined;
      if (diff < START_RECORDING_DELAY) {
        await runOnJS(takePhoto)();
      } else if (isRecording.current) {
        await runOnJS(stopRecording)();
      }
      isPressingButton.value = false;
      runOnJS(setIsPressingButton)(false);
    });
  //#endregion

  //#region Pan Gesture for Zoom
  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .onBegin((event) => {
      const yForFullZoom = event.absoluteY * 0.7;
      const offsetYForFullZoom = event.absoluteY - yForFullZoom;
      const offsetY =
        interpolate(cameraZoom.value, [minZoom, maxZoom], [0, offsetYForFullZoom], Extrapolate.CLAMP);
      cameraZoom.offsetY = offsetY;
      cameraZoom.startY = event.absoluteY;
    })
    .onUpdate((event) => {
      if (!cameraZoom.offsetY || !cameraZoom.startY) return;
      const yForFullZoom = cameraZoom.startY * 0.7;
      cameraZoom.value = interpolate(
        event.absoluteY - cameraZoom.offsetY,
        [yForFullZoom, cameraZoom.startY],
        [maxZoom, minZoom],
        Extrapolate.CLAMP,
      );
    });
  //#endregion

  //#region Animation
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(isPressingButton.value ? 1 : 0),
      },
    ],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: withTiming(enabled ? 1 : 0.3),
    transform: [
      {
        scale: enabled
          ? isPressingButton.value
            ? withRepeat(withSpring(1), -1, true)
            : withSpring(0.9)
          : withSpring(0.6),
      },
    ],
  }));
  //#endregion
  //if (device == null) return <NoCameraDeviceError />

  return (
    <GestureDetector gesture={Gesture.Simultaneous(tapGesture, panGesture)}>
      <Reanimated.View {...props} style={[buttonStyle, style]}>
        <View style={styles.flex}>
          <Reanimated.View style={[styles.shadow, shadowStyle]} />
          <View style={styles.button} />
        </View>
      </Reanimated.View>
    </GestureDetector>
  );
};

export default React.memo(CaptureButton);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  shadow: {
    position: 'absolute',
    width: CAPTURE_BUTTON_SIZE,
    height: CAPTURE_BUTTON_SIZE,
    borderRadius: CAPTURE_BUTTON_SIZE / 2,
    backgroundColor: '#e34077',
  },
  button: {
    width: CAPTURE_BUTTON_SIZE,
    height: CAPTURE_BUTTON_SIZE,
    borderRadius: CAPTURE_BUTTON_SIZE / 2,
    borderWidth: BORDER_WIDTH,
    borderColor: 'white',
  },
});
