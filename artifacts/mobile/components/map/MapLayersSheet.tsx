import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { BASEMAPS } from "@/constants/Map";
import { strings } from "@/constants/Strings";
import type { MapPreferences } from "@/types/Map";
import { Modal, Pressable, Text, View } from "react-native";

const s = strings.map.layersSheet;

interface MapLayersSheetProps {
  visible: boolean;
  preferences: MapPreferences;
  onChange: (prefs: Partial<MapPreferences>) => void;
  onClose: () => void;
}

/** Bottom sheet behind the layers button: basemap and pin clustering. */
export function MapLayersSheet({
  visible,
  preferences,
  onChange,
  onClose,
}: MapLayersSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-text/40"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={s.done}
        />
        <View className="bg-surface rounded-t-2xl px-5 pt-5 pb-safe-offset-5 gap-4">
          <Text accessibilityRole="header" className="type-h2 text-text">
            {s.title}
          </Text>

          <View className="gap-2">
            <Text className="type-label text-text-muted">{s.basemap}</Text>
            <SegmentedControl
              options={BASEMAPS}
              value={preferences.basemap}
              onChange={(basemap) => onChange({ basemap })}
              labels={s.basemaps}
              label={s.basemap}
            />
          </View>

          <View className="flex-row items-center gap-3">
            <View className="flex-1 gap-0.5">
              <Text className="type-body-strong text-text">{s.cluster}</Text>
              <Text className="type-body-small text-text-muted">
                {s.clusterHint}
              </Text>
            </View>
            <Toggle
              value={preferences.cluster}
              onValueChange={(cluster) => onChange({ cluster })}
              accessibilityLabel={s.cluster}
            />
          </View>

          <Button variant="secondary" onPress={onClose}>
            {s.done}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
