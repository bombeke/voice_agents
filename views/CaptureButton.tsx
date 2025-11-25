import { CAPTURE_BUTTON_SIZE } from "@/constants/Camera";
import React, { useCallback, useRef } from "react";
import {
  Alert,
  StyleSheet,
  View,
  ViewProps,
} from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Camera, PhotoFile, VideoFile } from "react-native-vision-camera";

export interface CaptureButtonProps extends ViewProps {
  camera: React.RefObject<Camera> | null;
  onMediaCaptured: (media: PhotoFile | VideoFile, type: "photo" | "video") => void;
  minZoom: number;
  maxZoom: number;
  cameraZoom: any;
  flash: "off" | "on";
  enabled: boolean;
  setIsPressingButton: (v: boolean) => void;
}

const START_RECORDING_DELAY = 200;
const BORDER_WIDTH = CAPTURE_BUTTON_SIZE * 0.1;

// recording ring
const RING_SIZE = CAPTURE_BUTTON_SIZE + 18;
const STROKE = 6;
const CIRC = Math.PI * (RING_SIZE - STROKE);

export default function CaptureButton({
  camera,
  onMediaCaptured,
  minZoom,
  maxZoom,
  cameraZoom,
  flash,
  enabled = true,
  setIsPressingButton,
  style,
  ...props
}: CaptureButtonProps) {
  const pressStart = useRef<number | null>(null);
  const isRecording = useRef(false);

  const isPressing = useSharedValue(false);
  const isRecordingAnim = useSharedValue(false);
  const progress = useSharedValue(0);

  /** PHOTO */
  const takePhoto = useCallback(async () => {
    Alert.alert('Tested')
    if (!camera?.current) return;
    const photo = await camera.current.takePhoto({ flash });
    onMediaCaptured(photo, "photo");
  }, [camera, flash, onMediaCaptured]);

  /** START RECORDING */
  const startRecording = useCallback(() => {
    if (!camera?.current) return;

    isRecording.current = true;
    isRecordingAnim.value = true;

    progress.value = withRepeat(withTiming(1, { duration: 15000 }), -1, false);

    camera.current.startRecording({
      flash,
      onRecordingFinished(video) {
        onMediaCaptured(video, "video");
        isRecording.current = false;
        isRecordingAnim.value = false;
        progress.value = 0;
      },
      onRecordingError(err) {
        console.error("Recording error:", err);
      },
    });
  }, [camera, flash, isRecordingAnim, onMediaCaptured, progress]);

  /** STOP RECORDING */
  const stopRecording = useCallback(async () => {
    if (!camera?.current) return;

    isRecordingAnim.value = false;
    progress.value = 0;

    await camera.current.stopRecording();
    isRecording.current = false;
    cancelAnimation(progress);
  }, [camera, isRecordingAnim, progress]);

  /** TAP GESTURE */
  const tapGesture = Gesture.Tap()
    .enabled(enabled)
    .onStart(() => {
      const now = Date.now();
      pressStart.current = now;

      isPressing.value = true;
      setIsPressingButton(true);

      setTimeout(() => {
        if (pressStart.current === now) startRecording();
      }, 200);
    })
    .onEnd(() => {
      const diff = Date.now() - (pressStart.current ?? 0);

      if (diff < 200) takePhoto();
      else if (isRecording.current) stopRecording();

      pressStart.current = null;
      isPressing.value = false;
      setIsPressingButton(false);
    });

  /** PAN FOR ZOOM */
  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .onUpdate((e) => {
      const delta = e.translationY;
      const newZoom = interpolate(
        -delta,
        [-200, 200],
        [minZoom, maxZoom],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      cameraZoom.value = newZoom;
    });

  /** ANIMATION: pulse */
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: isRecordingAnim.value
      ? withRepeat(withTiming(0.3, { duration: 700 }), -1, true)
      : 0,
    transform: [{
      scale: isRecordingAnim.value
        ? withRepeat(withTiming(1.35, { duration: 700 }), -1, true)
        : 1,
    }],
  }));

  /** ANIMATION: button */
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(isRecordingAnim.value ? 0.75 : 1) }],
    backgroundColor: isRecordingAnim.value ? "#ff3b30" : "white",
  }));

  /** ANIMATION: ring */
  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value),
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(tapGesture, panGesture)}>
      <Animated.View style={[styles.wrapper, style]} {...props}>
        <View style={styles.container}>
          <Animated.View style={[styles.pulse, pulseStyle]} />

          <Svg width={RING_SIZE} height={RING_SIZE} style={styles.progressSvg}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={(RING_SIZE - STROKE) / 2}
              stroke="rgba(255,0,0,0.3)"
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={CIRC}
            />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={(RING_SIZE - STROKE) / 2}
              stroke="white"
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={CIRC}
              animatedProps={ringAnimatedProps}
            />
          </Svg>

          <Animated.View
            style={[
              styles.captureButton,
              { borderWidth: BORDER_WIDTH, borderColor: "white" },
              buttonAnimatedStyle,
            ]}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
  wrapper: {
    width: CAPTURE_BUTTON_SIZE + 40,
    height: CAPTURE_BUTTON_SIZE + 40,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: CAPTURE_BUTTON_SIZE + 40,
    height: CAPTURE_BUTTON_SIZE + 40,
    justifyContent: "center",
    alignItems: "center",
  },
  pulse: {
    position: "absolute",
    width: CAPTURE_BUTTON_SIZE + 20,
    height: CAPTURE_BUTTON_SIZE + 20,
    borderRadius: (CAPTURE_BUTTON_SIZE + 20) / 2,
    backgroundColor: "rgba(255,0,0,0.4)",
  },
  captureButton: {
    width: CAPTURE_BUTTON_SIZE,
    height: CAPTURE_BUTTON_SIZE,
    borderRadius: CAPTURE_BUTTON_SIZE / 2,
  },
  progressSvg: {
    position: "absolute",
  },
});
