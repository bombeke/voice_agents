import { strings } from "@/constants/Strings";
import {
  toScreenRect,
  type Size,
  type ViewportTransform,
} from "@/helpers/detectionGeometry";
import type { Track } from "@/helpers/detectionTracker";
import { fill } from "@/helpers/format";
import type { TrackLabel } from "@/hooks/useLiveDetection";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { withUniwind } from "uniwind";

const AnimatedView = withUniwind(Animated.View);

/** Boxes glide between inferences instead of jumping. */
const GLIDE = { duration: 80 };
/** Put the label inside the box when there's no room above it. */
const LABEL_ROOM = 24;

interface DetectionOverlayProps {
  tracks: SharedValue<Track[]>;
  labels: TrackLabel[];
  transform: ViewportTransform;
  viewport: Size;
}

/**
 * Tracked detections drawn over the preview (after the executorch gallery's
 * DetectionOverlay). React renders one box per track id and only when the set
 * of tracks changes; positions follow the shared value on the UI thread.
 */
export function DetectionOverlay({
  tracks,
  labels,
  transform,
  viewport,
}: DetectionOverlayProps) {
  const summary = labels.length
    ? fill(strings.capture.detected, { count: labels.length })
    : strings.capture.detectionsNone;
  return (
    <View
      className="absolute inset-0"
      pointerEvents="none"
      accessible
      accessibilityLabel={summary}
    >
      {labels.map((t) => (
        <TrackBox
          key={t.trackId}
          track={t}
          tracks={tracks}
          transform={transform}
          viewport={viewport}
        />
      ))}
    </View>
  );
}

interface TrackBoxProps {
  track: TrackLabel;
  tracks: SharedValue<Track[]>;
  transform: ViewportTransform;
  viewport: Size;
}

function TrackBox({ track, tracks, transform, viewport }: TrackBoxProps) {
  const { trackId, label, suggested } = track;
  // The first frame places the box; later ones glide.
  const placed = useSharedValue(false);

  const boxStyle = useAnimatedStyle(() => {
    const current = tracks.value.find((t) => t.trackId === trackId);
    if (!current) return { opacity: withTiming(0, GLIDE) };
    const rect = toScreenRect(current.box, transform, viewport);
    if (!placed.value) {
      placed.value = true;
      return { opacity: 1, ...rect };
    }
    return {
      opacity: 1,
      left: withTiming(rect.left, GLIDE),
      top: withTiming(rect.top, GLIDE),
      width: withTiming(rect.width, GLIDE),
      height: withTiming(rect.height, GLIDE),
    };
  });

  const chipStyle = useAnimatedStyle(() => {
    const current = tracks.value.find((t) => t.trackId === trackId);
    const top = current
      ? toScreenRect(current.box, transform, viewport).top
      : 0;
    return { top: top < LABEL_ROOM ? 2 : -LABEL_ROOM };
  });

  const band = suggested
    ? strings.capture.suggested
    : strings.capture.confidenceHigh;

  return (
    <AnimatedView
      className={`absolute rounded border-2 border-accent ${suggested ? "border-dashed bg-accent/5" : "bg-accent/10"}`}
      style={boxStyle}
    >
      <AnimatedView
        className={`absolute left-0 px-1.5 py-0.5 rounded ${suggested ? "bg-camera/80" : "bg-accent"}`}
        style={chipStyle}
      >
        <Text
          numberOfLines={1}
          className={`type-chip text-[11px] ${suggested ? "text-accent" : "text-on-accent"}`}
        >
          {`${label} · ${band}`}
        </Text>
      </AnimatedView>
    </AnimatedView>
  );
}
