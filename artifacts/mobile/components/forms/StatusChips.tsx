import { Chip } from "@/components/ui/Chip";
import { strings } from "@/constants/Strings";
import type { AssetStatus } from "@/types/Capture";
import { View } from "react-native";

interface StatusChipsProps {
  options: readonly AssetStatus[];
  selected: readonly AssetStatus[];
  onToggle: (status: AssetStatus) => void;
  disabled?: boolean;
}

/** Multi-select condition chips; ink-filled when selected. */
export function StatusChips({
  options,
  selected,
  onToggle,
  disabled,
}: StatusChipsProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((status) => (
        <Chip
          key={status}
          label={strings.capture.statuses[status]}
          selected={selected.includes(status)}
          disabled={disabled}
          onPress={() => onToggle(status)}
        />
      ))}
    </View>
  );
}
