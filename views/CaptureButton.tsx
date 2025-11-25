import { CAPTURE_BUTTON_SIZE } from "@/constants/Camera";
import React, { useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  ViewProps,
} from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  interpolate,
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
  enabled,
  setIsPressingButton,
  style,
  ...props
}: CaptureButtonProps) {
  console.log("CAM_ENABLED:",enabled);
  const pressStart = useRef<number | null>(null);
  const isRecording = useRef(false);

  const isPressing = useSharedValue(false);
  const isRecordingAnim = useSharedValue(false);
  const progress = useSharedValue(0);

  /** PHOTO */
  const takePhoto = useCallback(async () => {
    if (!camera?.current) return;
    const photo = await camera.current.takePhoto({ flash });
    onMediaCaptured(photo, "photo");
  }, [camera, onMediaCaptured, flash]);

  /** START RECORDING  */
  const startRecording = useCallback(() => {
    if (!camera?.current) return;

    isRecording.current = true;
    isRecordingAnim.value = true;

    progress.value = withRepeat(
      withTiming(1, { duration: 15000 }),
      -1,
      false
    );

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
  }, [camera, flash, onMediaCaptured]);

  /** STOP RECORDING */
  const stopRecording = useCallback(async () => {
    if (!camera?.current) return;

    isRecordingAnim.value = false;
    progress.value = 0;

    await camera.current.stopRecording();
    isRecording.current = false;
    cancelAnimation(progress);
  }, [camera]);

  /** TAP GESTURE (photo vs video) */
  const tapGesture = Gesture.Tap()
    //.enabled(enabled)
    .maxDuration(600000)
    .onStart(() => {
      const now = Date.now();
      pressStart.current = now;
      isPressing.value = true;
      setIsPressingButton(true);

      setTimeout(() => {
        if (pressStart.current === now) {
          startRecording();
        }
      }, START_RECORDING_DELAY);
    })
    .onEnd(() => {
      const diff = Date.now() - (pressStart.current ?? 0);

      if (diff < START_RECORDING_DELAY) {
        takePhoto();
      } 
      else if (isRecording.current) {
        stopRecording();
      }

      pressStart.current = null;
      isPressing.value = false;
      setIsPressingButton(false);
    });

  /** PAN FOR ZOOM */
  const panGesture = Gesture.Pan()
    //.enabled(enabled)
    .onBegin((e) => {
      const yMax = e.absoluteY * 0.7;
      const offset = e.absoluteY - yMax;

      cameraZoom.offsetY = interpolate(
        cameraZoom.value,
        [minZoom, maxZoom],
        [0, offset],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      cameraZoom.startY = e.absoluteY;
    })
    .onUpdate((e) => {
      if (!cameraZoom.offsetY || !cameraZoom.startY) return;

      const yMax = cameraZoom.startY * 0.7;
      cameraZoom.value = interpolate(
        e.absoluteY - cameraZoom.offsetY,
        [yMax, cameraZoom.startY],
        [maxZoom, minZoom],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
    });

  /** ANIMATION: outer pulse */
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: isRecordingAnim.value
      ? withRepeat(withTiming(0.3, { duration: 700 }), -1, true)
      : 0,
    transform: [
      {
        scale: isRecordingAnim.value
          ? withRepeat(withTiming(1.35, { duration: 700 }), -1, true)
          : 1,
      },
    ],
  }));

  /** ANIMATION: main button shrink + color */
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withTiming(isRecordingAnim.value ? 0.75 : 1, { duration: 250 }) },
    ],
    backgroundColor: isRecordingAnim.value ? "#ff3b30" : "white",
  }));

  /** ANIMATION: recording progress ring */
  //@ts-ignore
  const ringAnimatedProps = useAnimatedStyle(() => ({
     strokeDashoffset: CIRC * (1 - progress.value),
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(tapGesture, panGesture)}>
      <Reanimated.View style={[style]} {...props}>
        <View style={styles.container}>

          {/* OUTER PULSE */}
          <Reanimated.View
            style={[
              styles.pulse,
              pulseStyle,
            ]}
          />

          {/* RECORDING PROGRESS RING */}
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            style={styles.progressSvg}
          >
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={(RING_SIZE - STROKE) / 2}
              stroke="rgba(255,0,0,0.3)"
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={CIRC}
            />
            
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={(RING_SIZE - STROKE) / 2}
              stroke="white"
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={CIRC}
              //@ts-ignore
              animatedProps={ringAnimatedProps}
            />
          </Svg>

          {/* MAIN SHUTTER BUTTON */}
          <Reanimated.View
            style={[
              styles.captureButton,
              { borderWidth: BORDER_WIDTH, borderColor: "white" },
              buttonAnimatedStyle,
            ]}
          />

        </View>
      </Reanimated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  pulse: {
    position: "absolute",
    width: CAPTURE_BUTTON_SIZE + 10,
    height: CAPTURE_BUTTON_SIZE + 10,
    borderRadius: (CAPTURE_BUTTON_SIZE + 10) / 2,
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
