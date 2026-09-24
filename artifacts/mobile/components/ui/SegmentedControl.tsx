import { Pressable, Text, View } from "react-native";

interface SegmentedControlProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Visible text per option. */
  labels: Record<T, string>;
  /** Accessible name of the group. */
  label: string;
  disabled?: boolean;
  /** `tablist` when the choice switches what the screen below shows. */
  role?: "radiogroup" | "tablist";
  /** 2 wraps the options into a grid, like the Settings theme picker. */
  columns?: 1 | 2;
}

/** Single choice from a few options: a muted track with a raised white segment. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labels,
  label,
  disabled,
  role = "radiogroup",
  columns = 1,
}: SegmentedControlProps<T>) {
  const tabs = role === "tablist";
  const grid = columns === 2;
  return (
    <View
      accessibilityRole={role}
      accessibilityLabel={label}
      className={`flex-row p-1 gap-1 rounded-button bg-surface-muted ${grid ? "flex-wrap" : ""}`}
    >
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole={tabs ? "tab" : "radio"}
            accessibilityState={
              tabs
                ? { selected, disabled: !!disabled }
                : { checked: selected, disabled: !!disabled }
            }
            disabled={disabled}
            onPress={() => onChange(option)}
            className={`${grid ? "grow basis-[48%]" : "flex-1"} min-h-11 items-center justify-center rounded-lg disabled:opacity-40 ${
              selected ? "bg-surface shadow-sm" : "active:bg-border"
            }`}
          >
            <Text
              className={`text-text ${selected ? "type-body-strong" : "type-body"}`}
            >
              {labels[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
