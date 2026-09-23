import { colors } from "@/constants/theme";
import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "./Icons";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name; also the visible label unless `children` is given. */
  label: string;
  /** Rich label content (e.g. with inline links); should read like `label`. */
  children?: ReactNode;
  disabled?: boolean;
}

/**
 * 20 px box (radius 4) with its label, in a ≥ 44 px touch row. Multi-line
 * labels keep the box beside their first line.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  children,
  disabled,
}: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      className="min-h-11 flex-row items-center disabled:opacity-40"
    >
      <View className="flex-1 flex-row items-start gap-2.5">
        <View
          className={`w-5 h-5 rounded items-center justify-center border-[1.5px] ${
            checked
              ? "bg-primary border-primary"
              : "bg-surface border-text-muted"
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
        <Text className="flex-1 type-body-small text-text">
          {children ?? label}
        </Text>
      </View>
    </Pressable>
  );
}
