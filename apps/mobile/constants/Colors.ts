/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

const primary = "#0A7EA4";
const secondary = "#2D5F7A";
const accent = "#4CAF50";
const danger = "#E53935";
const warning = "#FFB300";

export default {
  light: {
    primary,
    secondary,
    accent,
    danger,
    warning,
    text: "#1A1A1A",
    textSecondary: "#666666",
    background: "#FFFFFF",
    surface: "#F5F5F5",
    border: "#E0E0E0",
    tint: primary,
    tabIconDefault: "#9E9E9E",
    tabIconSelected: primary,
    success: accent,
    mapCluster: primary,
    mapClusterBorder: "#FFFFFF",
    cardBackground: "#FFFFFF",
    shadow: "#000000",
  },
};
