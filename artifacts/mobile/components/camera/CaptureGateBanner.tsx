import {
  CaptureAccuracyGate,
  MAX_CAPTURE_ACCURACY_M,
} from "@/hooks/useCaptureAccuracyGate";
import { memo, useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { withUniwind } from "uniwind";

const AnimatedView = withUniwind(Animated.View);

type Props = Pick<CaptureAccuracyGate, "status" | "accuracy" | "error">;

const fmt = (m: number | null) => (m === null ? "—" : `±${m.toFixed(1)} m`);

function copy({ status, accuracy, error }: Props) {
  switch (status) {
    case "acquiring":
      return { title: "Locating you…", detail: "Waiting for a GPS fix." };
    case "denied":
    case "error":
      return {
        title: "Location unavailable",
        detail: error ?? "Capture is disabled until location works.",
      };
    case "unknown":
      return {
        title: "GPS precision unknown",
        detail: "This device reports no accuracy — capture is locked.",
      };
    case "imprecise":
      return {
        title: `GPS ${fmt(accuracy)} — waiting for a better fix`,
        detail: `Hold still; capture needs ${MAX_CAPTURE_ACCURACY_M} m or better.`,
      };
    case "ready":
      return {
        title: `GPS ${fmt(accuracy)} — ready to capture`,
        detail: `Within the ${MAX_CAPTURE_ACCURACY_M} m survey tolerance.`,
      };
  }
}

/**
 * Overlay feedback for the accuracy gate: shows the live fix quality and pulses
 * green the moment the capture button unlocks.
 */
export const CaptureGateBanner = memo((props: Props) => {
  const { status } = props;
  const { title, detail } = copy(props);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status !== "ready") {
      pulse.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [status, pulse]);

  const tone =
    status === "ready"
      ? "bg-success/90 border-white/45"
      : status === "denied" || status === "error" || status === "unknown"
        ? "bg-danger/90 border-white/35"
        : "bg-black/70 border-white/25";

  return (
    <View
      className="absolute top-4 inset-x-0 items-center z-20"
      pointerEvents="none"
    >
      <AnimatedView
        className={`min-w-[220px] max-w-[90%] px-4 py-2.5 rounded-button border items-center ${tone}`}
        style={{
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.06],
              }),
            },
          ],
        }}
      >
        <Text className="type-body-strong text-white">{title}</Text>
        <Text className="type-caption text-white/85 mt-0.5">{detail}</Text>
      </AnimatedView>
    </View>
  );
});

CaptureGateBanner.displayName = "CaptureGateBanner";
