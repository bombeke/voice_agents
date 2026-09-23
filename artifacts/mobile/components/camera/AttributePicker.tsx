import { ATTRIBUTE_OPTIONS } from "@/constants/Attributes";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { formatAttributeValue } from "@/helpers/detectionReview";
import type { DetectionAttribute } from "@/types/Capture";
import { Modal, Pressable, Text, View } from "react-native";
import { Icon } from "@/components/ui/Icons";

interface AttributePickerProps {
  /** The attribute being corrected; null keeps the sheet closed. */
  attribute: DetectionAttribute | null;
  onPick: (value: string) => void;
  onClose: () => void;
}

/** Bottom sheet for correcting an AI value: "edit, don't type" (§4.2). */
export function AttributePicker({
  attribute,
  onPick,
  onClose,
}: AttributePickerProps) {
  const options = attribute ? (ATTRIBUTE_OPTIONS[attribute.key] ?? []) : [];

  return (
    <Modal
      visible={!!attribute}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={onClose}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      {attribute ? (
        <View className="bg-surface rounded-t-2xl px-4 pt-4 pb-safe-offset-6 gap-1">
          <Text
            accessibilityRole="header"
            className="type-overline text-text-muted mb-2"
          >
            {strings.attributes[attribute.key].label}
          </Text>
          <View accessibilityRole="radiogroup">
            {options.map((option) => {
              const selected = option === attribute.value;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => onPick(option)}
                  className="min-h-[52px] px-3 flex-row items-center justify-between rounded-xl active:bg-surface-muted"
                >
                  <Text className="type-body text-text">
                    {formatAttributeValue(attribute.key, option)}
                  </Text>
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
