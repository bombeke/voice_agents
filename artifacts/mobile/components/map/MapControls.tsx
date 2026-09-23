import { Icon, type IconName } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { Pressable, View } from "react-native";

function ControlButton({
  icon,
  color,
  label,
  onPress,
}: {
  icon: IconName;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="w-12 h-12 rounded-button bg-surface border border-border items-center justify-center active:bg-surface-muted"
    >
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  );
}

interface MapControlsProps {
  onLayersPress: () => void;
  onLocatePress: () => void;
}

/** Layers and "center on my location", stacked on the right edge. */
export function MapControls({
  onLayersPress,
  onLocatePress,
}: MapControlsProps) {
  return (
    <View className="gap-2">
      <ControlButton
        icon="layers"
        color={colors.text}
        label={strings.map.layers}
        onPress={onLayersPress}
      />
      <ControlButton
        icon="locate"
        color={colors.primary}
        label={strings.map.locate}
        onPress={onLocatePress}
      />
    </View>
  );
}
