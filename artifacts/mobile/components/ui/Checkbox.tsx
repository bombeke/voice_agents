import { colors } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";
import { Icon } from "./Icons";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label; also the accessible name. */
  label: string;
  disabled?: boolean;
}

/** 20 px box (radius 4) with its label, in a ≥ 44 px touch row. */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled,
}: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      className="min-h-11 flex-row items-center gap-2.5 disabled:opacity-40"
    >
      <View
        className={`w-5 h-5 rounded items-center justify-center border-[1.5px] ${
          checked ? "bg-primary border-primary" : "bg-surface border-text-muted"
        }`}
      >
        {checked && (
          <Icon
            name="check"
            size={16}
            color={colors.onPrimary}
            strokeWidth={3}
          />
        )}
      </View>
      <Text className="flex-1 type-body-small text-text">{label}</Text>
    </Pressable>
  );
}
