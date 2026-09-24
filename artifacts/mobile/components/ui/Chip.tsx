import type { AssetCategory } from "@/constants/Colors";
import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

/** Status tones, or a category's tile colours (e.g. "Energy & Power"). */
export type ChipTone =
  "neutral" | "primary" | "success" | "warning" | "danger" | AssetCategory;

const TONES: Record<ChipTone, { bg: string; fg: string }> = {
  neutral: { bg: "bg-surface-muted", fg: "text-text" },
  primary: { bg: "bg-primary-soft", fg: "text-primary" },
  success: { bg: "bg-success-soft", fg: "text-on-success-soft" },
  warning: { bg: "bg-warning-soft", fg: "text-on-warning-soft" },
  danger: { bg: "bg-danger-soft", fg: "text-on-danger-soft" },
  energy: { bg: "bg-energy-tile", fg: "text-energy-ink" },
  water: { bg: "bg-water-tile", fg: "text-water-ink" },
  telecom: { bg: "bg-telecom-tile", fg: "text-telecom-ink" },
  roads: { bg: "bg-roads-tile", fg: "text-roads-ink" },
};

interface ChipProps {
  label: string;
  /** Static tone. Ignored when the chip is selectable (`onPress` set). */
  tone?: ChipTone;
  icon?: ReactNode;
  /**
   * Makes the chip a toggle for multi-select (the tagging form's status
   * list): white/outlined when off, ink-filled when selected.
   */
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  /**
   * `checkbox` (default) for multi-select; `radio` or `tab` when the chips
   * are a single choice, like the review queue's reason filter.
   */
  role?: "checkbox" | "radio" | "tab";
}

export function Chip({
  label,
  tone = "neutral",
  icon,
  onPress,
  selected = false,
  disabled,
  role = "checkbox",
}: ChipProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={role}
        accessibilityState={
          role === "tab"
            ? { selected, disabled }
            : { checked: selected, disabled }
        }
        hitSlop={4}
        className={`min-h-11 px-4 py-1.5 rounded-full flex-row items-center justify-center gap-1.5 border active:opacity-85 disabled:opacity-40 ${
          selected ? "bg-text border-text" : "bg-surface border-border-strong"
        }`}
      >
        {icon}
        <Text
          className={`type-label text-[15px] text-center ${
            selected ? "text-surface" : "text-text"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  const { bg, fg } = TONES[tone];
  return (
    <View
      className={`h-7 px-2.5 rounded-full flex-row items-center gap-1 self-start ${bg}`}
    >
      {icon}
      <Text className={`type-chip ${fg}`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
