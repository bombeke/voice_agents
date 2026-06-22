import * as Haptics from "expo-haptics";
import { ReactNode, useCallback, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  PressableProps,
  ViewStyle,
} from "react-native";

const NATIVE_DRIVER = Platform.OS !== "web";

export interface IPressableButton extends PressableProps {
  /**
   * Opacity to use when `disabled={true}`
   * @default 0.35
   */
  disabledOpacity?: number;
  /**
   * Opacity to animate to when pressed
   * @default 0.85
   */
  activeOpacity?: number;
  /**
   * Scale to animate to when pressed
   * @default 0.96
   */
  activeScale?: number;
  /**
   * Fire haptic feedback on press (native only)
   * @default true
   */
  haptic?: boolean;
  children: ReactNode;
}

export const PressableButton = ({
  style,
  disabled = false,
  disabledOpacity = 0.35,
  activeOpacity = 0.85,
  activeScale = 0.96,
  haptic = true,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: IPressableButton) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(
    (e: any) => {
      if (haptic && Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      Animated.spring(scale, {
        toValue: activeScale,
        useNativeDriver: NATIVE_DRIVER,
        speed: 50,
        bounciness: 4,
      }).start();
      onPressIn?.(e);
    },
    [haptic, scale, activeScale, onPressIn],
  );

  const handlePressOut = useCallback(
    (e: any) => {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: NATIVE_DRIVER,
        speed: 50,
        bounciness: 4,
      }).start();
      onPressOut?.(e);
    },
    [scale, onPressOut],
  );

  return (
    <Animated.View
      style={[
        style as ViewStyle,
        {
          opacity: disabled ? disabledOpacity : 1,
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => ({ opacity: pressed ? activeOpacity : 1 })}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};
