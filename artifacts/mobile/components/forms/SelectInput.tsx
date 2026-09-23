import { colors } from "@/constants/theme";
import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

const items = [
  { name: "Electric pole", value: "electric_pole" },
  { name: "Telecom pole", value: "telecom_pole" },
  { name: "Drainage", value: "drainage" },
];

export function TagSelectInput({
  value: controlled,
  onValueChange,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
} = {}) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState("");
  const value = controlled ?? internal;
  const selected = items.find((item) => item.value === value);

  const select = (next: string) => {
    setInternal(next);
    onValueChange?.(next);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="w-[220px] h-[52px] px-4 flex-row items-center justify-between rounded-xl bg-surface border border-border-strong active:bg-surface-muted"
      >
        <Text
          className={`type-body ${selected ? "text-text" : "text-text-muted"}`}
        >
          {selected?.name ?? "Select Tag"}
        </Text>
        <ChevronDown size={20} color={colors.textMuted} />
      </Pressable>

      {/* Bottom sheet on native, same modal on web. */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40"
          onPress={() => setOpen(false)}
        />
        <View className="bg-surface rounded-t-2xl px-4 pt-4 pb-8 gap-1">
          <Text className="type-overline text-text-muted mb-2">Tags</Text>
          {items.map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: item.value === value }}
              onPress={() => select(item.value)}
              className="min-h-[52px] px-3 flex-row items-center justify-between rounded-xl active:bg-surface-muted"
            >
              <Text className="type-body text-text">{item.name}</Text>
              {item.value === value ? (
                <Check size={16} color={colors.primary} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}
