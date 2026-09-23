import { colors } from "@/constants/theme";
import { useEffect, useRef } from "react";
import { Animated, Pressable } from "react-native";
import { withUniwind } from "uniwind";

const AnimatedView = withUniwind(Animated.View);

// Track 52×32, knob 26, padding 3 → knob travels 52 - 26 - 6.
const TRAVEL = 20;

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Required: the switch has no visible text of its own. */
  accessibilityLabel: string;
  disabled?: boolean;
}

/** Settings switch: 52×32 track inside a 64×44 touch target. */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
}: ToggleProps) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [value, progress]);

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.borderStrong, colors.primary],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      className="w-16 h-11 pr-2 items-end justify-center disabled:opacity-40"
    >
      {/* Colour and position are animated, so they stay in `style`. */}
      <AnimatedView
        className="w-[52px] h-8 rounded-full p-[3px]"
        style={{ backgroundColor: trackColor }}
      >
        <AnimatedView
          className="w-[26px] h-[26px] rounded-full bg-surface shadow-sm"
          style={{ transform: [{ translateX }] }}
        />
      </AnimatedView>
    </Pressable>
  );
}
