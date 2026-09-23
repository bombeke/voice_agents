import { DETECTOR_INPUT_SIZE } from "@/constants/DetectorModel";
import {
  computeViewportTransform,
  type Size,
} from "@/helpers/detectionGeometry";
import type { LiveDetection } from "@/hooks/useLiveDetection";
import type { CaptureCategory } from "@/types/Capture";
import { useMemo, useState } from "react";
import { View } from "react-native";
import {
  Camera as VisionCamera,
  type CameraDevice,
  type CameraPhotoOutput,
} from "react-native-vision-camera";
import { withUniwind } from "uniwind";
import { DetectionOverlay } from "./DetectionOverlay";
import { FramingGuide } from "./FramingGuide";

const Camera = withUniwind(VisionCamera);

interface CameraViewportProps {
  device: CameraDevice;
  isActive: boolean;
  detection: LiveDetection;
  photoOutput: CameraPhotoOutput;
  category: CaptureCategory;
  locked: boolean;
}

/**
 * Full-bleed preview with tracked boxes and the framing guide on top, after
 * the executorch gallery's RealtimeDetectionViewport. Boxes are mapped with
 * the preview's measured size, not the window size.
 */
export function CameraViewport({
  device,
  isActive,
  detection,
  photoOutput,
  category,
  locked,
}: CameraViewportProps) {
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const transform = useMemo(
    () =>
      computeViewportTransform(
        viewport,
        DETECTOR_INPUT_SIZE,
        detection.frameSize,
      ),
    [viewport, detection.frameSize],
  );

  return (
    <View
      className="absolute inset-0 overflow-hidden bg-camera"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setViewport({ width, height });
      }}
    >
      <Camera
        className="absolute inset-0"
        device={device}
        isActive={isActive}
        outputs={[detection.frameOutput, photoOutput]}
        orientationSource="interface"
        resizeMode="cover"
        enableNativeZoomGesture
        enableNativeTapToFocusGesture
      />
      <FramingGuide category={category} locked={locked} />
      <DetectionOverlay
        tracks={detection.tracks}
        labels={detection.trackLabels}
        transform={transform}
        viewport={viewport}
      />
    </View>
  );
}
