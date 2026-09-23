import { Icon } from "@/components/ui/Icons";
import { colors } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";

interface CaptureStepHeaderProps {
  title: string;
  subtitle?: string;
  /** "Step 2 of 3"; left out when editing a saved record. */
  step?: string;
  backLabel: string;
  onBack: () => void;
}

/** Back chevron, title and subtitle, and the step counter of the capture flow. */
export function CaptureStepHeader({
  title,
  subtitle,
  step,
  backLabel,
  onBack,
}: CaptureStepHeaderProps) {
  return (
    <View className="pt-safe-offset-2 pb-3 px-2 flex-row items-start gap-1">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        className="w-11 h-11 items-center justify-center rounded-full active:bg-surface-muted"
      >
        <Icon name="chevron-left" size={26} color={colors.text} />
      </Pressable>
      <View className="flex-1 pt-1">
        <Text accessibilityRole="header" className="type-h1 text-text">
          {title}
        </Text>
        {subtitle ? (
          <Text className="type-body-small text-text-muted">{subtitle}</Text>
        ) : null}
      </View>
      {step ? (
        <Text className="w-16 pt-2 pr-2 type-caption text-text-muted">
          {step}
        </Text>
      ) : null}
    </View>
  );
}
