import type { BlurViewProps } from "expo-blur";
import { BlurView as ExpoBlurView } from "expo-blur";
import React from "react";
import { Platform } from "react-native";
import { withUniwind } from "uniwind";

const BlurView = withUniwind(ExpoBlurView);

//const FALLBACK_COLOR = 'rgba(140, 140, 140, 0.3)'

const StatusBarBlurBackgroundImpl = ({
  style,
  ...props
}: BlurViewProps): React.ReactElement | null => {
  if (Platform.OS !== "ios") return null;

  return (
    <BlurView
      // Empty view padded to the status bar height.
      className="absolute top-0 inset-x-0 pt-safe"
      style={style}
      intensity={25}
      tint="light"
      {...props}
    />
  );
};

export const StatusBarBlurBackground = React.memo(StatusBarBlurBackgroundImpl);
