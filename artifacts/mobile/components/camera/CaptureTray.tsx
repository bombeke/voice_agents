import { Icon } from "@/components/ui/Icons";
import { MAX_PHOTOS } from "@/constants/Capture";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { fill } from "@/helpers/format";
import { toFileUri } from "@/services/storage/ImageStore";
import type { CapturedPhoto, PhotoQuality } from "@/types/Capture";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

interface CaptureTrayProps {
  photos: CapturedPhoto[];
  /** GPS gate passed (or the surveyor chose to save a draft). */
  canCapture: boolean;
  isCapturing: boolean;
  /** Offer "save as draft" (GPS hasn't locked for a while). */
  offerDraft: boolean;
  onCapture: () => void;
  onRetake: (index: number) => void;
  onContinue: () => void;
  onSaveDraft: () => void;
}

/** "Photo 2 of 3 · sharp · exposure OK": the next shot plus the last shot's checks. */
export function statusLine(photos: readonly CapturedPhoto[]): string {
  const index = Math.min(photos.length + 1, MAX_PHOTOS);
  const parts = [fill(strings.capture.photoOf, { index })];
  const quality: PhotoQuality | undefined = photos.at(-1)?.quality;
  if (quality?.sharp != null) {
    parts.push(quality.sharp ? strings.capture.sharp : strings.capture.blurry);
  }
  if (quality?.exposureOk != null) {
    parts.push(
      quality.exposureOk
        ? strings.capture.exposureOk
        : strings.capture.exposureBad,
    );
  }
  return parts.join(" · ");
}

/** Photo slots, shutter and the note under it (design screen 4). */
export function CaptureTray({
  photos,
  canCapture,
  isCapturing,
  offerDraft,
  onCapture,
  onRetake,
  onContinue,
  onSaveDraft,
}: CaptureTrayProps) {
  const full = photos.length >= MAX_PHOTOS;
  const shutterEnabled = canCapture && !isCapturing && !full;

  return (
    <View className="bg-camera/90 px-6 pt-3.5 pb-safe-offset-4 gap-3.5">
      <View className="flex-row items-center justify-between">
        <View
          accessibilityLabel={fill(strings.capture.photosTaken, {
            count: photos.length,
          })}
          className="flex-row gap-1.5"
        >
          {Array.from({ length: MAX_PHOTOS }, (_, i) => {
            const photo = photos[i];
            return photo ? (
              <Pressable
                key={i}
                onPress={() => onRetake(i)}
                accessibilityRole="button"
                accessibilityLabel={fill(strings.capture.photoSlot, {
                  index: i + 1,
                })}
                className="w-10 h-10 rounded-lg overflow-hidden active:opacity-80"
              >
                <Image
                  source={{ uri: toFileUri(photo.imageUri) }}
                  className="w-full h-full"
                />
              </Pressable>
            ) : (
              <View
                key={i}
                className="w-10 h-10 rounded-lg border-[1.5px] border-dashed border-white/50"
              />
            );
          })}
        </View>

        <Pressable
          onPress={onCapture}
          disabled={!shutterEnabled}
          accessibilityRole="button"
          accessibilityLabel={
            canCapture ? strings.capture.shutter : strings.capture.shutterLocked
          }
          accessibilityState={{ disabled: !shutterEnabled, busy: isCapturing }}
          className={`w-20 h-20 rounded-full border-4 items-center justify-center ${canCapture ? "border-gps-locked" : "border-white/35"}`}
        >
          <View
            className={`w-[62px] h-[62px] rounded-full items-center justify-center ${canCapture ? "bg-white active:opacity-80" : "bg-white/20"}`}
          >
            {isCapturing ? (
              <ActivityIndicator colorClassName="accent-camera" />
            ) : canCapture ? null : (
              <Icon name="lock" size={24} color={colors.surface} />
            )}
          </View>
        </Pressable>

        {photos.length > 0 ? (
          <Pressable
            onPress={onContinue}
            disabled={isCapturing}
            accessibilityRole="button"
            className="w-[132px] h-11 rounded-pill-button bg-primary items-center justify-center active:bg-primary-pressed disabled:opacity-40"
          >
            <Text className="type-body-strong text-on-primary">
              {strings.capture.continue}
            </Text>
          </Pressable>
        ) : (
          <Text className="w-[132px] type-caption text-on-camera-muted text-right">
            {canCapture
              ? strings.capture.shutterNoteReady
              : strings.capture.shutterNoteLocked}
          </Text>
        )}
      </View>

      {!canCapture && offerDraft ? (
        <Pressable
          onPress={onSaveDraft}
          accessibilityRole="button"
          className="self-center min-h-11 justify-center"
        >
          <Text className="font-body-semi text-[14px] text-white underline">
            {strings.capture.saveDraft}
          </Text>
        </Pressable>
      ) : (
        <Text className="self-center min-h-11 type-body-small text-[13px] leading-[44px] text-on-camera-muted">
          {statusLine(photos)}
        </Text>
      )}
    </View>
  );
}
