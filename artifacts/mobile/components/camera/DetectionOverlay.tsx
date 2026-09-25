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
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { withUniwind } from "uniwind";

const AnimatedView = withUniwind(Animated.View);

/** Boxes glide between inferences instead of jumping. */
const GLIDE = { duration: 80 };
/** Put the label inside the box when there's no room above it. */
const LABEL_ROOM = 32;

interface DetectionOverlayProps {
  tracks: SharedValue<Track[]>;
  labels: TrackLabel[];
  transform: ViewportTransform;
  viewport: Size;
  /** Last inference time, shown on each box; null hides it. */
  inferenceMs?: number | null;
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
  inferenceMs = null,
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
          inferenceMs={inferenceMs}
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
  inferenceMs: number | null;
}

function TrackBox({
  track,
  tracks,
  transform,
  viewport,
  inferenceMs,
}: TrackBoxProps) {
  const { trackId, label, suggested, confidence } = track;
  // The first frame places the box; later ones glide.
  const placed = useSharedValue(false);

  // One lookup per frame, shared by the box and its label.
  const rect = useDerivedValue(() => {
    const current = tracks.value.find((t) => t.trackId === trackId);
    return current ? toScreenRect(current.box, transform, viewport) : null;
  });

  const boxStyle = useAnimatedStyle(() => {
    const r = rect.value;
    if (!r) return { opacity: withTiming(0, GLIDE) };
    if (!placed.value) {
      placed.value = true;
      return { opacity: 1, ...r };
    }
    return {
      opacity: 1,
      left: withTiming(r.left, GLIDE),
      top: withTiming(r.top, GLIDE),
      width: withTiming(r.width, GLIDE),
      height: withTiming(r.height, GLIDE),
    };
  });

  const chipStyle = useAnimatedStyle(() => {
    const top = rect.value?.top ?? 0;
    return { top: top < LABEL_ROOM ? 2 : -LABEL_ROOM };
  });

  const text =
    inferenceMs === null
      ? fill(strings.capture.boxLabel, {
          label,
          confidence: confidence.toFixed(2),
        })
      : fill(strings.capture.boxLabelTimed, {
          label,
          confidence: confidence.toFixed(2),
          ms: inferenceMs,
        });

  return (
    <AnimatedView
      className={`absolute rounded-xs border-[3px] border-accent ${suggested ? "border-dashed bg-accent/5" : ""}`}
      style={boxStyle}
    >
      <AnimatedView
        className={`absolute left-[-3px] px-2 py-1 rounded-lg ${suggested ? "bg-camera/80" : "bg-accent"}`}
        style={chipStyle}
      >
        <Text
          numberOfLines={1}
          className={`type-chip text-[13px] ${suggested ? "text-accent" : "text-on-accent"}`}
        >
          {text}
        </Text>
      </AnimatedView>
    </AnimatedView>
  );
}
