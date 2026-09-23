/**
 * Design tokens from design/ui-screens.html (see CLAUDE.md).
 * The app ships a single high-contrast light theme for outdoor/sunlight use,
 * so `dark` mirrors `light` until a dark theme is designed.
 *
 * Styling uses Tailwind classes backed by the same tokens in global.css
 * (`bg-surface`, `text-text-muted`, …). Keep the two in sync; use these JS
 * values only for props that can't take a className (icon `color`, Skia,
 * MapLibre layers, Animated interpolations).
 */

export const palette = {
  background: "#F4F2EC",
  surface: "#FFFFFF",
  surfaceMuted: "#ECE9E0",
  text: "#1A1D1B",
  textMuted: "#55594F",
  border: "#DAD6CA",
  borderStrong: "#C9C4B6",

  primary: "#0F5E51",
  primaryPressed: "#0A4439",
  primarySoft: "#DDEBE6",
  onPrimary: "#FFFFFF",
  accent: "#F5C04A",
  onAccent: "#1A1D1B",
  /** Rails in the app logo. */
  logoRail: "#5FA895",

  success: "#1E6B3A",
  successSoft: "#DDEEE2",
  onSuccessSoft: "#143F24",
  warning: "#8A4205",
  warningSoft: "#FBEBD6",
  onWarningSoft: "#5A2B03",
  danger: "#A3261B",
  dangerSoft: "#F8DCD8",
  onDangerSoft: "#7A1C13",
} as const;

export const CategoryColors = {
  energy: { solid: "#9A5B00", tile: "#F6E9D2", border: "#E8D3AE" },
  water: { solid: "#1B5E91", tile: "#DCE9F4", border: "#BCD3E8" },
  telecom: { solid: "#5A3F8F", tile: "#E7E0F2", border: "#D0C4E6" },
  roads: { solid: "#6A4A2E", tile: "#EDE3D8", border: "#D9C8B5" },
} as const;

export type AssetCategory = keyof typeof CategoryColors;

export const ConfidenceColors = {
  high: palette.success,
  medium: palette.warning,
  low: palette.danger,
} as const;

const theme = {
  ...palette,
  tint: palette.primary,
  icon: palette.textMuted,
  tabIconDefault: palette.textMuted,
  tabIconSelected: palette.primary,
  mapCluster: palette.primary,
  mapClusterBorder: palette.surface,
  shadow: "#000000",
};

export const Colors = {
  light: theme,
  dark: theme,
};

export default Colors;
