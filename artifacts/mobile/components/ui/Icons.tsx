import Svg, { Circle, Path } from "react-native-svg";

/** Stroke icons copied from design/ui-screens.html (24×24 viewBox). */
type Shape = { d: string } | { cx: number; cy: number; r: number };

const ICONS = {
  energy: [{ d: "M13 2 4 14h7l-1 8 9-12h-7z" }],
  water: [{ d: "M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" }],
  telecom: [
    { d: "M12 10 7 21M12 10l5 11M9 16h6" },
    { cx: 12, cy: 8, r: 2 },
    { d: "M7.5 4.5a6 6 0 0 0 0 7M16.5 4.5a6 6 0 0 1 0 7" },
  ],
  roads: [{ d: "M8 3 4 21M16 3l4 18M12 4v3M12 11v3M12 18v3" }],
  capture: [{ d: "M4 8h3l2-3h6l2 3h3v11H4z" }, { cx: 12, cy: 13, r: 3.5 }],
  map: [{ d: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" }, { d: "M9 4v14M15 6v14" }],
  records: [
    { d: "M8 6h13M8 12h13M8 18h13" },
    { cx: 4, cy: 6, r: 1 },
    { cx: 4, cy: 12, r: 1 },
    { cx: 4, cy: 18, r: 1 },
  ],
  review: [
    { d: "M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z" },
    { d: "m9 12 2 2 4-4" },
  ],
  shield: [
    { d: "M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z" },
    { cx: 12, cy: 11, r: 2 },
    { d: "M12 13v3" },
  ],
  eye: [
    { d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" },
    { cx: 12, cy: 12, r: 3 },
  ],
  "eye-off": [
    { d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" },
    { cx: 12, cy: 12, r: 3 },
    { d: "M3 3l18 18" },
  ],
  check: [{ d: "m5 12.5 4.5 4.5L19 7.5" }],
  "chevron-left": [{ d: "m15 5-7 7 7 7" }],
  info: [{ cx: 12, cy: 12, r: 9 }, { d: "M12 11v5M12 8v.5" }],
  "chevron-right": [{ d: "m9 5 7 7-7 7" }],
  sync: [
    { d: "M20 11a8 8 0 0 0-14-5l-2 2M4 13a8 8 0 0 0 14 5l2-2" },
    { d: "M4 4v4h4M20 20v-4h-4" },
  ],
  user: [{ cx: 12, cy: 8, r: 4 }, { d: "M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" }],
  close: [{ d: "M6 6l12 12M18 6 6 18" }],
  flash: [{ d: "M13 2 4 14h7l-1 8 9-12h-7z" }],
  "flash-off": [
    { d: "M13 2 9.5 6.7M16 10h3l-3.9 5.2M11.4 16.3 10 22l3.4-4.6M8 12l-4 2h7" },
    { d: "M3 3l18 18" },
  ],
  lock: [{ d: "M5 11h14v10H5z" }, { d: "M8 11V8a4 4 0 0 1 8 0v3" }],
  crosshair: [
    { d: "M12 3v3M12 18v3M3 12h3M18 12h3" },
    { cx: 12, cy: 12, r: 5 },
  ],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name].map((shape: Shape, i) =>
        "d" in shape ? (
          <Path key={i} d={shape.d} />
        ) : (
          <Circle key={i} {...shape} />
        ),
      )}
    </Svg>
  );
}
