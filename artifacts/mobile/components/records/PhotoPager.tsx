import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Icon } from "@/components/ui/Icons";
import type { AssetCategory } from "@/constants/Colors";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { fill } from "@/helpers/format";
import { photoCounter } from "@/helpers/recordDetail";
import { toFileUri } from "@/services/storage/ImageStore";
import type { RecordPhoto } from "@/types/Capture";
import { useState } from "react";
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

const d = strings.records.detail;

/** Fill for a photo that isn't on the device (mock records, cleared storage). */
const PLACEHOLDER: Record<AssetCategory, string> = {
  energy: "bg-energy-tile",
  water: "bg-water-tile",
  telecom: "bg-telecom-tile",
  roads: "bg-roads-tile",
};

function Photo({
  photo,
  label,
  category,
}: {
  photo: RecordPhoto;
  label: string;
  category: AssetCategory;
}) {
  const [failed, setFailed] = useState(false);
  const uri = toFileUri(photo.uri ?? undefined);

  if (!uri || failed) {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label}. ${d.noPhoto}`}
        className={`flex-1 items-center justify-center gap-2 ${PLACEHOLDER[category]}`}
      >
        <CategoryIcon category={category} />
        <Text className="type-caption text-text-muted">{d.noPhoto}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      accessibilityLabel={label}
      resizeMode="cover"
      onError={() => setFailed(true)}
      className="flex-1 bg-surface-muted"
    />
  );
}

interface PhotoPagerProps {
  photos: readonly RecordPhoto[];
  category: AssetCategory;
  onBack: () => void;
}

/**
 * The record's photos, swiped one page at a time, with the back button and
 * a "1 of 2 photos" counter over them. A record without photos still gets
 * one placeholder page, so the header keeps its height.
 */
export function PhotoPager({ photos, category, onBack }: PhotoPagerProps) {
  const pages = photos.length ? photos : [{ uri: null }];
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);

  const onPageChange = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = e.nativeEvent;
    if (!layoutMeasurement.width) return;
    const page = Math.round(contentOffset.x / layoutMeasurement.width);
    setIndex(Math.min(Math.max(page, 0), pages.length - 1));
  };

  return (
    <View
      className="h-70 bg-surface-muted"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={d.photos}
        onMomentumScrollEnd={onPageChange}
        className="flex-1"
      >
        {pages.map((photo, i) => (
          <View key={i} style={{ width }} className="h-full">
            <Photo
              photo={photo}
              category={category}
              label={fill(d.photoLabel, { index: i + 1, count: pages.length })}
            />
          </View>
        ))}
      </ScrollView>

      <View
        pointerEvents="box-none"
        className="absolute top-0 left-0 right-0 pt-safe-offset-3 px-4 flex-row items-center justify-between"
      >
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={d.back}
          hitSlop={4}
          className="w-11 h-11 rounded-full items-center justify-center bg-camera/70 active:bg-camera"
        >
          <Icon name="chevron-left" size={22} color={colors.surface} />
        </Pressable>
        {photos.length ? (
          <View className="h-8 px-3 rounded-full justify-center bg-camera/70">
            <Text
              accessibilityLiveRegion="polite"
              className="type-body-small font-semibold text-surface"
            >
              {photoCounter(index, photos.length)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
