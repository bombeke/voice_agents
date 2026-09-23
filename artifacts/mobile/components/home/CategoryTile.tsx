import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { strings } from "@/constants/Strings";
import type { AssetCategory } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";

/** Full class names so Tailwind's scanner finds them. */
const TILE: Record<AssetCategory, string> = {
  energy: "bg-energy-tile border-energy-border",
  water: "bg-water-tile border-water-border",
  telecom: "bg-telecom-tile border-telecom-border",
  roads: "bg-roads-tile border-roads-border",
};

const INK: Record<AssetCategory, string> = {
  energy: "text-energy-ink",
  water: "text-water-ink",
  telecom: "text-telecom-ink",
  roads: "text-roads-ink",
};

interface CategoryTileProps {
  category: AssetCategory;
  onPress: (category: AssetCategory) => void;
}

/** One of the four "What are you capturing?" tiles. */
export function CategoryTile({ category, onPress }: CategoryTileProps) {
  const { label, description } = strings.categories[category];
  return (
    <Pressable
      onPress={() => onPress(category)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      className={`flex-1 h-[152px] p-4 rounded-2xl border justify-between active:opacity-85 ${TILE[category]}`}
    >
      <CategoryIcon category={category} />
      <View className="gap-1">
        <Text
          className={`font-heading text-[18px] leading-[22px] ${INK[category]}`}
        >
          {label}
        </Text>
        <Text className="type-caption text-text-muted" numberOfLines={2}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}
