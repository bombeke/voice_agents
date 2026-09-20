import {
  CaptureAccuracyGate,
  MAX_CAPTURE_ACCURACY_M,
} from "@/hooks/useCaptureAccuracyGate";
import { memo, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

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
      ? styles.ready
      : status === "denied" || status === "error" || status === "unknown"
        ? styles.blocked
        : styles.waiting;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.banner,
          tone,
          {
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.06],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </Animated.View>
    </View>
  );
});

CaptureGateBanner.displayName = "CaptureGateBanner";

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  banner: {
    minWidth: 220,
    maxWidth: "90%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  waiting: {
    backgroundColor: "rgba(0,0,0,0.72)",
    borderColor: "rgba(255,255,255,0.25)",
  },
  ready: {
    backgroundColor: "rgba(22,163,74,0.92)",
    borderColor: "rgba(255,255,255,0.45)",
  },
  blocked: {
    backgroundColor: "rgba(185,28,28,0.92)",
    borderColor: "rgba(255,255,255,0.35)",
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  detail: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 2,
  },
});
