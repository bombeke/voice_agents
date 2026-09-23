import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/** Rails and map pin on the primary tile, from design/ui-screens.html. */
export function AppLogo({ size = 60 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      accessibilityRole="image"
      accessibilityLabel={strings.auth.logoLabel}
    >
      <Rect width={48} height={48} rx={12} fill={colors.primary} />
      <Path
        d="M10 34h28M10 26h28M18 14v20M30 14v20"
        stroke={colors.logoRail}
        strokeWidth={2}
      />
      <Path
        d="M24 9c-4.4 0-8 3.4-8 7.7C16 22 24 29 24 29s8-7 8-12.3C32 12.4 28.4 9 24 9z"
        fill={colors.accent}
      />
      <Circle cx={24} cy={16.5} r={3} fill={colors.primary} />
    </Svg>
  );
}
