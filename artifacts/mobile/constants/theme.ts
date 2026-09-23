/**
 * Design tokens from design/ui-screens.html (documented in CLAUDE.md).
 * Colours live in ./Colors so the legacy `Colors.light/dark` API and the theme
 * share one source. Use these tokens instead of inline values.
 */
import {
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from "@expo-google-fonts/archivo";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from "@expo-google-fonts/ibm-plex-mono";
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from "@expo-google-fonts/ibm-plex-sans";
import type { TextStyle } from "react-native";
import { CategoryColors, ConfidenceColors, palette } from "./Colors";

export const colors = palette;
export { CategoryColors, ConfidenceColors };
export type { AssetCategory } from "./Colors";

export const radii = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  pill: 999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  base: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  xxxl: 20,
  huge: 24,
  /** Horizontal screen gutter. */
  gutter: 20,
} as const;

export const sizes = {
  /** Minimum touch target. */
  touch: 44,
  touchPreferred: 48,
  button: 52,
  input: 52,
  listRow: 52,
  chip: 28,
  badge: 24,
  iconSm: 16,
  icon: 20,
  iconTab: 22,
  iconLg: 24,
  /** Tab bar height above the bottom safe-area inset. */
  tabBar: 64,
} as const;

/**
 * Custom fonts are one family per weight; never combine them with
 * `fontWeight` (Android would fall back to the system font).
 */
export const fonts = {
  display: "Archivo_800ExtraBold",
  heading: "Archivo_700Bold",
  headingSemi: "Archivo_600SemiBold",
  body: "IBMPlexSans_400Regular",
  bodyMedium: "IBMPlexSans_500Medium",
  bodySemi: "IBMPlexSans_600SemiBold",
  bodyBold: "IBMPlexSans_700Bold",
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
} as const;

/** Pass to `useFonts` in the root layout. */
export const fontAssets = {
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
};

export const typography = {
  display: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.64,
  },
  h1: {
    fontFamily: fonts.heading,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.28,
  },
  h2: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.24,
  },
  stat: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 26 },
  title: { fontFamily: fonts.bodySemi, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
  chip: { fontFamily: fonts.bodySemi, fontSize: 12.5, lineHeight: 16 },
  tab: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16 },
  overline: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.96,
    textTransform: "uppercase",
  },
  mono: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

export const theme = {
  colors,
  radii,
  spacing,
  sizes,
  fonts,
  typography,
} as const;
export type Theme = typeof theme;
export default theme;
