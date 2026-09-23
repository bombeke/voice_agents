import { Icon } from "@/components/ui/Icons";
import { ASSET_CATEGORIES } from "@/constants/Capture";
import type { AssetCategory } from "@/constants/Colors";
import { strings } from "@/constants/Strings";
import { CategoryColors } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";

/** Selected tile colours per category, written out for Tailwind's scanner. */
const SELECTED: Record<AssetCategory, { tile: string; ink: string }> = {
  energy: { tile: "bg-energy-tile border-energy", ink: "text-energy-ink" },
  water: { tile: "bg-water-tile border-water", ink: "text-water-ink" },
  telecom: { tile: "bg-telecom-tile border-telecom", ink: "text-telecom-ink" },
  roads: { tile: "bg-roads-tile border-roads", ink: "text-roads-ink" },
};

interface CategoryGridProps {
  value: AssetCategory | null;
  onChange: (category: AssetCategory) => void;
  /** Accessible name of the group. */
  label: string;
  disabled?: boolean;
}

/** 2×2 single-choice grid of the four asset categories. */
export function CategoryGrid({
  value,
  onChange,
  label,
  disabled,
}: CategoryGridProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className="flex-row flex-wrap gap-2.5"
    >
      {ASSET_CATEGORIES.map((category) => {
        const selected = category === value;
        return (
          <Pressable
            key={category}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(category)}
            className={`grow basis-[45%] min-h-[52px] px-3 py-2.5 flex-row items-center justify-center gap-1.5 rounded-button border active:opacity-85 disabled:opacity-40 ${
              selected
                ? SELECTED[category].tile
                : "bg-surface border-border-strong"
            }`}
          >
            {selected ? (
              <Icon
                name="check"
                size={18}
                color={CategoryColors[category].ink}
                strokeWidth={2.5}
              />
            ) : null}
            <Text
              className={`type-body-strong text-center ${
                selected ? SELECTED[category].ink : "text-text"
              }`}
            >
              {strings.categories[category].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
