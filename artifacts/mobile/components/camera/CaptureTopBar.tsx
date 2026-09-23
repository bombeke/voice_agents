import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import type { CaptureCategory } from "@/types/Capture";
import { Pressable, Text, View } from "react-native";

/** Full class names so Tailwind's scanner finds them. */
const PILL: Record<CaptureCategory, string> = {
  energy: "bg-energy",
  water: "bg-water",
  telecom: "bg-telecom",
  roads: "bg-roads",
  auto: "bg-primary",
};

interface CaptureTopBarProps {
  category: CaptureCategory;
  flash: boolean;
  onClose: () => void;
  onToggleFlash: () => void;
}

/** Close, the chosen category, and the flash toggle over the preview. */
export function CaptureTopBar({
  category,
  flash,
  onClose,
  onToggleFlash,
}: CaptureTopBarProps) {
  const label =
    category === "auto"
      ? strings.capture.autoCategory
      : strings.categories[category].label;
  return (
    <View className="flex-row items-center justify-between px-4 pt-safe-offset-3">
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={strings.capture.close}
        className="w-11 h-11 rounded-pill-button bg-camera/60 items-center justify-center active:opacity-80"
      >
        <Icon name="close" size={20} color={colors.surface} strokeWidth={2.2} />
      </Pressable>

      <View
        accessibilityRole="text"
        className={`h-8 px-3 rounded-2xl flex-row items-center gap-1.5 ${PILL[category]}`}
      >
        <Icon
          name={category === "auto" ? "crosshair" : category}
          size={16}
          color={colors.surface}
        />
        <Text className="type-chip text-[13px] text-white">{label}</Text>
      </View>

      <Pressable
        onPress={onToggleFlash}
        accessibilityRole="switch"
        accessibilityState={{ checked: flash }}
        accessibilityLabel={
          flash ? strings.capture.flashOn : strings.capture.flashOff
        }
        className="w-11 h-11 rounded-pill-button bg-camera/60 items-center justify-center active:opacity-80"
      >
        <Icon
          name={flash ? "flash" : "flash-off"}
          size={20}
          color={colors.surface}
        />
      </Pressable>
    </View>
  );
}
