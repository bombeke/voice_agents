import { colors } from "@/constants/theme";
import { Modal, Pressable, Text, View } from "react-native";
import { Icon } from "./Icons";

interface OptionSheetProps<T extends string | number> {
  /** Header, and the accessible name of the choice. */
  title: string;
  /** Null keeps the sheet closed. */
  options: readonly T[] | null;
  value: T;
  labels: Record<T, string>;
  onPick: (value: T) => void;
  onClose: () => void;
}

/** Bottom sheet for a single choice from a short list, e.g. Units. */
export function OptionSheet<T extends string | number>({
  title,
  options,
  value,
  labels,
  onPick,
  onClose,
}: OptionSheetProps<T>) {
  return (
    <Modal
      visible={!!options}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-text/40"
        onPress={onClose}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      {options ? (
        <View className="bg-surface rounded-t-2xl px-4 pt-4 pb-safe-offset-6 gap-1">
          <Text
            accessibilityRole="header"
            className="type-overline text-text-muted mb-2"
          >
            {title}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={title}>
            {options.map((option) => {
              const selected = option === value;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => onPick(option)}
                  className="min-h-[52px] px-3 flex-row items-center justify-between rounded-xl active:bg-surface-muted"
                >
                  <Text className="type-body text-text">{labels[option]}</Text>
                  {selected ? (
                    <Icon name="check" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </Modal>
  );
}
