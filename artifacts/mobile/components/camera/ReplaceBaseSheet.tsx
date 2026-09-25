import { Button } from "@/components/ui/Button";
import { InfoNote } from "@/components/ui/InfoNote";
import { strings } from "@/constants/Strings";
import type { Size } from "@/helpers/detectionGeometry";
import {
  formatLabel,
  photoRect,
  viewToPhotoFraction,
} from "@/helpers/detectionReview";
import { fill } from "@/helpers/format";
import { toFileUri } from "@/services/storage/ImageStore";
import type { ReviewDetection } from "@/types/Capture";
import { useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";

interface ReplaceBaseSheetProps {
  /** The detection being re-placed; null closes the sheet. */
  detection: ReviewDetection | null;
  /** The photo's pixel size, from its capture metadata. */
  photoSize: Size;
  /**
   * Called with the tapped point as fractions of the photo. Returns false
   * when the ray through it misses the measured ground.
   */
  onPlace: (point: { x: number; y: number }) => boolean;
  onClose: () => void;
}

/**
 * "Re-place by tapping the base" on the review screen: the photo full width
 * with the asset's box; the surveyor taps where it meets the ground. The ray
 * through that pixel meets the ground plane the AR session measured when the
 * photo was taken (see replaceDetection).
 */
export function ReplaceBaseSheet({
  detection,
  photoSize: photo,
  onPlace,
  onClose,
}: ReplaceBaseSheetProps) {
  const [view, setView] = useState<Size>({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  const r = strings.capture.review;
  const label = detection ? formatLabel(detection.label) : "";

  const close = () => {
    setFailed(false);
    onClose();
  };

  return (
    <Modal
      visible={!!detection}
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View className="flex-1 bg-camera pt-safe-offset-3 pb-safe-offset-3 gap-3">
        <View className="px-4 gap-1">
          <Text accessibilityRole="header" className="type-h2 text-surface">
            {fill(r.replaceTitle, { label: label.toLowerCase() })}
          </Text>
          <Text className="type-body-small text-on-camera-muted">
            {r.replaceHint}
          </Text>
        </View>

        {detection ? (
          <Pressable
            className="flex-1"
            accessibilityRole="button"
            accessibilityLabel={fill(r.replacePhoto, { label })}
            onLayout={(e) => setView(e.nativeEvent.layout)}
            onPress={(e) => {
              const { locationX: x, locationY: y } = e.nativeEvent;
              const at = viewToPhotoFraction({ x, y }, photo, view);
              if (at && onPlace(at)) close();
              else setFailed(true);
            }}
          >
            <Image
              source={{ uri: toFileUri(detection.imageUri) }}
              resizeMode="contain"
              className="absolute inset-0"
            />
            {view.width > 0 && photo.width > 0 ? (
              <View
                pointerEvents="none"
                className="absolute rounded border-[3px] border-accent"
                style={photoRect(detection.box, photo, view)}
              />
            ) : null}
          </Pressable>
        ) : null}

        <View className="px-4 gap-3">
          {failed ? (
            <InfoNote tone="warning">{r.replaceFailed}</InfoNote>
          ) : null}
          <Button variant="secondary" onPress={close}>
            {r.replaceCancel}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
