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
}

/** Single choice from a few options: a muted track with a raised white segment. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labels,
  label,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className="flex-row p-1 gap-1 rounded-button bg-surface-muted"
    >
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(option)}
            className={`flex-1 min-h-11 items-center justify-center rounded-lg disabled:opacity-40 ${
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
