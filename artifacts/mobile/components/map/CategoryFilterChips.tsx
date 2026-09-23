import { strings } from "@/constants/Strings";
import type { MapCategoryFilter } from "@/types/Map";
import { Pressable, ScrollView, Text, View } from "react-native";

const FILTERS: readonly MapCategoryFilter[] = [
  "all",
  "energy",
  "water",
  "telecom",
  "roads",
];

/** Selected fill per chip, written out in full so Tailwind can see them. */
const SELECTED: Record<MapCategoryFilter, string> = {
  all: "bg-text border-text",
  energy: "bg-energy border-energy",
  water: "bg-water border-water",
  telecom: "bg-telecom border-telecom",
  roads: "bg-roads border-roads",
};

interface CategoryFilterChipsProps {
  value: MapCategoryFilter;
  onChange: (value: MapCategoryFilter) => void;
}

/** Single-choice category filter; the selected chip takes its category colour. */
export function CategoryFilterChips({
  value,
  onChange,
}: CategoryFilterChipsProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={strings.map.filterLabel}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
        keyboardShouldPersistTaps="handled"
      >
        {FILTERS.map((filter) => {
          const selected = filter === value;
          return (
            <Pressable
              key={filter}
              onPress={() => onChange(filter)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              hitSlop={4}
              className={`h-9 px-3.5 rounded-full border items-center justify-center active:opacity-85 ${
                selected ? SELECTED[filter] : "bg-surface border-border"
              }`}
            >
              <Text
                className={`type-chip text-[13px] ${selected ? "text-surface" : "text-text"}`}
              >
                {strings.map.filters[filter]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
