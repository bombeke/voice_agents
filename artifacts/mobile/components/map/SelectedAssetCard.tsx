import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { conditionChips, formatAssetMeta } from "@/helpers/mapAssets";
import type { Position } from "@/hooks/useLastKnownPosition";
import type { MapAsset } from "@/types/Map";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AssetProfile } from "./AssetProfile";

const a = strings.map.asset;

interface SelectedAssetCardProps {
  asset: MapAsset;
  /** The device position, for "38 m away"; null hides the distance. */
  position: Position | null;
  profileOpen: boolean;
  onToggleProfile: () => void;
  onRecapture: () => void;
  onViewRecord: () => void;
  onClose: () => void;
}

/** Bottom card for the tapped pin, expanding into the full asset profile. */
export function SelectedAssetCard({
  asset,
  position,
  profileOpen,
  onToggleProfile,
  onRecapture,
  onViewRecord,
  onClose,
}: SelectedAssetCardProps) {
  const chips = conditionChips(asset);

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={a.label}
      className="bg-surface rounded-2xl border border-border px-4 pt-3.5 pb-4 gap-2.5"
    >
      <View className="flex-row items-center gap-3">
        <CategoryIcon category={asset.category} size="md" />
        <View className="flex-1 gap-0.5">
          <Text
            accessibilityRole="header"
            className="type-title font-heading text-text"
            numberOfLines={1}
          >
            {asset.title}
          </Text>
          <Text className="type-caption text-text-muted" numberOfLines={2}>
            {formatAssetMeta(asset, position)}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={a.close}
          className="w-11 h-11 -mr-2 items-center justify-center rounded-full active:bg-surface-muted"
        >
          <Icon name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {chips.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Chip key={chip.label} label={chip.label} tone={chip.tone} />
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={onToggleProfile}
        accessibilityRole="button"
        accessibilityState={{ expanded: profileOpen }}
        accessibilityLabel={profileOpen ? a.hideProfile : a.showProfile}
        className="min-h-11 flex-row items-center justify-between rounded-xl px-1 active:bg-surface-muted"
      >
        <Text className="type-body-small font-semibold text-primary">
          {profileOpen ? a.hideProfile : a.showProfile}
        </Text>
        <View className={profileOpen ? "rotate-180" : ""}>
          <Icon name="chevron-down" size={18} color={colors.primary} />
        </View>
      </Pressable>

      {profileOpen ? (
        <ScrollView
          className="max-h-80 -mx-1"
          contentContainerClassName="px-1 pb-1"
          showsVerticalScrollIndicator={false}
        >
          <AssetProfile asset={asset} />
        </ScrollView>
      ) : null}

      <View className="flex-row gap-2">
        <Button variant="secondary" className="flex-1" onPress={onRecapture}>
          {a.recapture}
        </Button>
        <Button className="flex-1" onPress={onViewRecord}>
          {a.viewRecord}
        </Button>
      </View>
    </View>
  );
}
