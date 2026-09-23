import { strings } from "@/constants/Strings";
import { meterFill, REQUIRED_GOOD_FIXES } from "@/helpers/accuracyGate";
import { fill, formatHeading } from "@/helpers/format";
import type { CaptureGateStatus } from "@/hooks/useCaptureAccuracyGate";
import type { GnssFix } from "@/types/Capture";
import { Text, View } from "react-native";

type Tone = "locked" | "confirming" | "acquiring" | "failed";

function toneOf(status: CaptureGateStatus): Tone {
  switch (status) {
    case "ready":
      return "locked";
    case "confirming":
      return "confirming";
    case "denied":
    case "error":
    case "unknown":
      return "failed";
    default:
      return "acquiring";
  }
}

/** Full class names so Tailwind's scanner finds them. */
const BORDER: Record<Tone, string> = {
  locked: "border-gps-locked",
  confirming: "border-gps-confirming",
  acquiring: "border-gps-acquiring",
  failed: "border-danger",
};
const TEXT: Record<Tone, string> = {
  locked: "text-gps-locked",
  confirming: "text-gps-confirming",
  acquiring: "text-gps-acquiring",
  failed: "text-gps-acquiring",
};
const FILL: Record<Tone, string> = {
  locked: "bg-gps-locked",
  confirming: "bg-gps-confirming",
  acquiring: "bg-gps-acquiring",
  failed: "bg-gps-acquiring",
};

interface AccuracyCardProps {
  status: CaptureGateStatus;
  accuracy: number | null;
  streak: number;
  latest: GnssFix | null;
  heading: number | null;
  error: string | null;
}

/** Receiver detail line, e.g. "18 sats · 3D · L1+L5 · 142° SE"; parts that are unknown are left out. */
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

/** Live GPS accuracy against the < 4 m gate (design screen 4). */
export function AccuracyCard({
  status,
  accuracy,
  streak,
  latest,
  heading,
  error,
}: AccuracyCardProps) {
  const tone = toneOf(status);
  const title = strings.capture.status[status];
  const detail = error ?? receiverLine(latest, heading);
  const accuracyText = accuracy === null ? "—" : `±${accuracy.toFixed(1)}`;
  const stableLabel = fill(strings.capture.stableFixes, { count: streak });

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={strings.capture.gpsRegion}
      accessibilityLiveRegion="polite"
      className={`mx-3 px-3.5 py-3 rounded-2xl bg-camera/80 border-[1.5px] gap-2.5 ${BORDER[tone]}`}
    >
      <View className="flex-row items-center gap-3">
        <View className="flex-row items-baseline gap-0.5">
          <Text
            className={`font-display text-[34px] leading-[36px] tracking-[-0.68px] ${TEXT[tone]}`}
          >
            {accuracyText}
          </Text>
          <Text className={`font-heading text-[15px] ${TEXT[tone]}`}>
            {strings.capture.accuracyUnit}
          </Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-body-bold text-[14px] leading-[18px] text-white">
            {title}
          </Text>
          {detail ? (
            <Text className="type-mono text-[12px] leading-[16px] text-on-camera-muted">
              {detail}
            </Text>
          ) : null}
        </View>
        <View
          accessible
          accessibilityLabel={stableLabel}
          className="flex-row gap-1"
        >
          {Array.from({ length: REQUIRED_GOOD_FIXES }, (_, i) => (
            <View
              key={i}
              className={`w-2.5 h-2.5 rounded-full ${i < streak ? FILL[tone] : "bg-white/25"}`}
            />
          ))}
        </View>
      </View>

      <View importantForAccessibility="no-hide-descendants" className="gap-1.5">
        <View className="h-2 rounded bg-white/20">
          <View
            className={`absolute left-0 top-0 bottom-0 rounded ${FILL[tone]}`}
            // Runtime geometry: how far the fix is along the 8 m → 0 m meter.
            style={{ width: `${Math.round(meterFill(accuracy) * 100)}%` }}
          />
          <View className="absolute left-1/2 -top-1 w-0.5 h-4 bg-white" />
        </View>
        <View className="flex-row justify-between">
          <Text className="type-caption text-[11.5px] text-on-camera-muted">
            {strings.capture.meterStart}
          </Text>
          <Text className="font-body-semi text-[11.5px] text-white">
            {strings.capture.meterTarget}
          </Text>
          <Text className="type-caption text-[11.5px] text-on-camera-muted">
            {strings.capture.meterEnd}
          </Text>
        </View>
      </View>
    </View>
  );
}
