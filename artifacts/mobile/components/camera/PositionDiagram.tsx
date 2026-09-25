import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { fill } from "@/helpers/format";
import { useState } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";

const HEIGHT = 140;
const GRID = 4;

interface PositionDiagramProps {
  /** Asset name for the label, e.g. "pole". */
  label: string;
  distanceM: number;
  bearingDeg: number;
  /** The asset dot's colour (its category's). */
  color: string;
}

/**
 * North-up sketch of where the asset is from the phone: "you" in the middle,
 * a dashed line to the asset at its bearing, the distance on the line and
 * the bearing on an arc from north.
 */
export function PositionDiagram({
  label,
  distanceM,
  bearingDeg,
  color,
}: PositionDiagramProps) {
  const [width, setWidth] = useState(0);
  const summary = fill(strings.capture.review.diagramSummary, {
    label,
    distance: distanceM.toFixed(1),
    bearing: Math.round(bearingDeg),
  });

  const cx = width / 2;
  const cy = HEIGHT / 2;
  const reach = Math.min(cx, cy) - 18;
  const rad = (bearingDeg * Math.PI) / 180;
  const tx = cx + Math.sin(rad) * reach;
  const ty = cy - Math.cos(rad) * reach;
  // Bearing arc from north, 22 px out.
  const arc = 22;
  const large = bearingDeg > 180 ? 1 : 0;
  const ax = cx + Math.sin(rad) * arc;
  const ay = cy - Math.cos(rad) * arc;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      className="h-[140px] rounded-lg overflow-hidden bg-background"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {Array.from({ length: GRID - 1 }, (_, i) => (
            <Line
              key={`v${i}`}
              x1={((i + 1) * width) / GRID}
              x2={((i + 1) * width) / GRID}
              y1={0}
              y2={HEIGHT}
              stroke={colors.border}
            />
          ))}
          {Array.from({ length: 2 }, (_, i) => (
            <Line
              key={`h${i}`}
              x1={0}
              x2={width}
              y1={((i + 1) * HEIGHT) / 3}
              y2={((i + 1) * HEIGHT) / 3}
              stroke={colors.border}
            />
          ))}
          <Line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - arc - 10}
            stroke={colors.textMuted}
            strokeDasharray="3 3"
          />
          <Path
            d={`M ${cx} ${cy - arc} A ${arc} ${arc} 0 ${large} 1 ${ax} ${ay}`}
            stroke={colors.textMuted}
            fill="none"
          />
          <Line
            x1={cx}
            y1={cy}
            x2={tx}
            y2={ty}
            stroke={colors.success}
            strokeWidth={2}
            strokeDasharray="6 5"
          />
          <SvgText
            x={(cx + tx) / 2 + 8}
            y={(cy + ty) / 2}
            fontSize={12}
            fill={colors.text}
          >
            {`${distanceM.toFixed(1)} m`}
          </SvgText>
          <SvgText x={cx + 10} y={cy - 8} fontSize={11} fill={colors.textMuted}>
            {`${Math.round(bearingDeg)}°`}
          </SvgText>
          <Rect
            x={cx - 8}
            y={cy - 8}
            width={16}
            height={16}
            rx={3}
            fill={colors.text}
          />
          <SvgText
            x={cx - 34}
            y={cy + 22}
            fontSize={12}
            fill={colors.textMuted}
          >
            {strings.capture.review.diagramYou}
          </SvgText>
          <Circle
            cx={tx}
            cy={ty}
            r={7}
            fill={color}
            stroke={colors.surface}
            strokeWidth={2}
          />
          <SvgText x={tx + 11} y={ty + 4} fontSize={12} fill={colors.text}>
            {label}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}
