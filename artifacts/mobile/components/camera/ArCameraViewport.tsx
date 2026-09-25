import { strings } from "@/constants/Strings";
import {
  computeViewportTransform,
  type Size,
} from "@/helpers/detectionGeometry";
import type { ArCapture } from "@/hooks/useArCapture";
import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { useMemo, useState, type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";
import { withUniwind } from "uniwind";
import { ArGroundScene } from "./ArGroundScene";
import { DetectionOverlay } from "./DetectionOverlay";

const ArNavigator = withUniwind(ViroARSceneNavigator);

interface ArCameraViewportProps {
  ar: ArCapture;
  /** Unmounting ends the AR session and frees the camera (review on top). */
  isActive: boolean;
  onPlaceFailed: () => void;
}

/**
 * The AR view as the camera preview: ViroARSceneNavigator owns the camera
 * (ARCore can't share it with VisionCamera), and detections, the tap layer
 * and the hint are React Native views on top. Boxes come from frames of this
 * same view, so they map onto it with a single scale.
 */
export function ArCameraViewport({
  ar,
  isActive,
  onPlaceFailed,
}: ArCameraViewportProps) {
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const transform = useMemo(
    () => computeViewportTransform(viewport, ar.frameSize ?? viewport),
    [viewport, ar.frameSize],
  );

  return (
    <View
      className="absolute inset-0 overflow-hidden bg-camera"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setViewport({ width, height });
        ar.onViewport({ width, height });
      }}
    >
      {isActive ? (
        <ArNavigator
          className="absolute inset-0"
          autofocus
          worldAlignment="Gravity"
          initialScene={{
            // Viro types scenes as argument-less; it passes arSceneNavigator.
            scene: ArGroundScene as unknown as () => ReactElement,
          }}
          viroAppProps={{ bridge: ar.bridge }}
        />
      ) : null}

      <DetectionOverlay
        tracks={ar.tracks}
        labels={ar.trackLabels}
        transform={transform}
        viewport={viewport}
        inferenceMs={ar.inferenceMs}
      />

      {ar.placing ? (
        <Pressable
          className="absolute inset-0 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={strings.capture.sheet.tapLayer}
          onPress={async (e) => {
            const { locationX: x, locationY: y } = e.nativeEvent;
            if (!(await ar.placeAt({ x, y }))) onPlaceFailed();
          }}
        >
          <View
            pointerEvents="none"
            className="px-4 py-2 rounded-[18px] bg-camera/80"
          >
            <Text className="type-body-small text-white">
              {strings.capture.sheet.placeHint}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
