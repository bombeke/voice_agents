import { colors } from "@/constants/theme";
import { Text, View } from "react-native";
import { Icon } from "./Icons";

type InfoNoteTone = "info" | "warning";

const TONES = {
  info: {
    box: "bg-info-soft",
    text: "text-on-info-soft",
    icon: "info",
    color: colors.onInfoSoft,
  },
  warning: {
    box: "bg-warning-soft",
    text: "text-on-warning-soft",
    icon: "warning",
    color: colors.onWarningSoft,
  },
} as const;

interface InfoNoteProps {
  children: string;
  /** `warning` for "please check" notes, like unsynced records at sign-out. */
  tone?: InfoNoteTone;
}

/** Callout (radius 12) with a leading icon: blue for info, amber for warnings. */
export function InfoNote({ children, tone = "info" }: InfoNoteProps) {
  const t = TONES[tone];
  return (
    <View
      // A warning is read as one announcement.
      accessible={tone === "warning"}
      accessibilityRole={tone === "warning" ? "alert" : undefined}
      className={`flex-row items-start gap-2.5 rounded-xl px-3.5 py-3 ${t.box}`}
    >
      <Icon name={t.icon} size={20} color={t.color} />
      <Text className={`flex-1 type-body-small ${t.text}`}>{children}</Text>
    </View>
  );
}
