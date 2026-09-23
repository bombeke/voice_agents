import { AssetCategory, CategoryColors, colors } from "@/constants/theme";
import { View } from "react-native";
import { Icon } from "./Icons";

type CategoryIconSize = "lg" | "md" | "sm";

/**
 * lg: category tile (44 px, solid fill, white glyph).
 * md: record list row (40 px, tinted fill, coloured glyph).
 * sm: "last captured" / compact rows (36 px, tinted fill).
 */
const SIZES: Record<
  CategoryIconSize,
  { box: string; glyph: number; solid: boolean }
> = {
  lg: { box: "w-11 h-11 rounded-xl", glyph: 24, solid: true },
  md: { box: "w-10 h-10 rounded-tile", glyph: 20, solid: false },
  sm: { box: "w-9 h-9 rounded-tile", glyph: 18, solid: false },
};

/** Full class names so Tailwind can see them. */
const FILL: Record<AssetCategory, { solid: string; tile: string }> = {
  energy: { solid: "bg-energy", tile: "bg-energy-tile" },
  water: { solid: "bg-water", tile: "bg-water-tile" },
  telecom: { solid: "bg-telecom", tile: "bg-telecom-tile" },
  roads: { solid: "bg-roads", tile: "bg-roads-tile" },
};

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  energy: "Energy & Power",
  water: "Water & Sanitation",
  telecom: "Telecom",
  roads: "Roads & Drainage",
};

interface CategoryIconProps {
  category: AssetCategory;
  size?: CategoryIconSize;
}

export function CategoryIcon({ category, size = "lg" }: CategoryIconProps) {
  const s = SIZES[size];
  const fill = FILL[category];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={CATEGORY_LABELS[category]}
      className={`items-center justify-center ${s.box} ${s.solid ? fill.solid : fill.tile}`}
    >
      <Icon
        name={category}
        size={s.glyph}
        color={s.solid ? colors.surface : CategoryColors[category].solid}
      />
    </View>
  );
}
