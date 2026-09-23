import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { BlurView as ExpoBlurView } from "expo-blur";
import { withUniwind } from "uniwind";

const BlurView = withUniwind(ExpoBlurView);

export default function BlurTabBarBackground() {
  return (
    <BlurView
      // System chrome material automatically adapts to the system's theme
      // and matches the native tab bar appearance on iOS.
      tint="systemChromeMaterial"
      intensity={100}
      className="absolute inset-0"
    />
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
