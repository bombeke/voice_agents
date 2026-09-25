import { strings } from "@/constants/Strings";
import { meterFill } from "@/helpers/accuracyGate";
import { fill, formatHeading } from "@/helpers/format";
import type { CaptureGateStatus } from "@/hooks/useCaptureAccuracyGate";
import type { ArTrackingState, GnssFix } from "@/types/Capture";
import { Text, View } from "react-native";

type Tone = "locked" | "confirming" | "acquiring";

function toneOf(status: CaptureGateStatus): Tone {
  if (status === "ready") return "locked";
  if (status === "confirming") return "confirming";
  return "acquiring";
}

/** Full class names so Tailwind's scanner finds them. */
const TEXT: Record<Tone, string> = {
  locked: "text-gps-locked",
  confirming: "text-gps-confirming",
  acquiring: "text-gps-acquiring",
};
const FILL: Record<Tone, string> = {
  locked: "bg-gps-locked",
  confirming: "bg-gps-confirming",
  acquiring: "bg-gps-acquiring",
};

/** Receiver detail for screen readers, e.g. "18 sats · 3D · L1+L5 · 142° SE". */
export function receiverLine(latest: GnssFix | null, heading: number | null) {
  return [
    latest?.satellites != null
      ? fill(strings.capture.satellites, { count: latest.satellites })
      : null,
    latest?.fixType ?? null,
    latest?.bands ?? null,
    heading != null ? formatHeading(heading) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

interface CaptureStatusStripProps {
  status: CaptureGateStatus;
  accuracy: number | null;
  latest: GnssFix | null;
  heading: number | null;
  error: string | null;
  /** null when the device has no AR. */
  tracking: ArTrackingState | null;
  /** Range to the locked asset, metres; null when nothing is locked. */
  rangeM: number | null;
  model: string;
  inferenceMs: number | null;
}

function Divider() {
  return <View className="w-px h-6 bg-white/30" />;
}

/**
 * The strip under the top bar (design/screens/Camera.png): GPS accuracy,
 * AR tracking, range to the asset and the on-device model's speed, over the
 * 8 m → 0 m accuracy meter with its 4 m target mark.
 */
export function CaptureStatusStrip({
  status,
  accuracy,
  latest,
  heading,
  error,
  tracking,
  rangeM,
  model,
  inferenceMs,
}: CaptureStatusStripProps) {
  const tone = toneOf(status);
  const accuracyText =
    accuracy === null
      ? strings.capture.strip.accuracyUnknown
      : fill(strings.capture.strip.accuracy, { accuracy: accuracy.toFixed(1) });
  const arText = strings.capture.strip.ar[tracking ?? "off"];
  const summary = [
    strings.capture.status[status],
    accuracyText,
    error ?? receiverLine(latest, heading),
    arText,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <View className="mx-3 gap-1.5">
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={summary}
        accessibilityLiveRegion="polite"
        className="min-h-12 px-4 py-2 rounded-[22px] bg-camera/85 flex-row items-center gap-3"
      >
        <View className="flex-row items-center gap-2">
          <View className={`w-2.5 h-2.5 rounded-full ${FILL[tone]}`} />
          <Text className={`type-mono text-[15px] ${TEXT[tone]}`}>
            {accuracyText}
          </Text>
        </View>
        <Divider />
        <Text
          numberOfLines={2}
          className={`flex-1 type-mono text-[14px] ${tracking === "normal" ? "text-white" : "text-on-camera-muted"}`}
        >
          {arText}
        </Text>
        {rangeM !== null ? (
          <>
            <Divider />
            <Text className="type-mono text-[14px] text-white">
              {fill(strings.capture.strip.range, {
                distance: rangeM.toFixed(1),
              })}
            </Text>
          </>
        ) : null}
        <Text
          numberOfLines={2}
          className="type-mono text-[13px] text-on-camera-muted"
        >
          {inferenceMs === null
            ? model
            : fill(strings.capture.strip.model, { model, ms: inferenceMs })}
        </Text>
      </View>

      <View
        importantForAccessibility="no-hide-descendants"
        className="mx-5 h-1 rounded-xs bg-white/20"
      >
        <View
          className={`absolute left-0 top-0 bottom-0 rounded-xs ${FILL[tone]}`}
          // Runtime geometry: how far the fix is along the 8 m → 0 m meter.
          style={{ width: `${Math.round(meterFill(accuracy) * 100)}%` }}
        />
        <View className="absolute left-1/2 -top-1 w-0.5 h-3 bg-white" />
      </View>
    </View>
  );
}
