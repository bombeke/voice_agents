import { Icon } from "@/components/ui/Icons";
import { MAX_PHOTOS } from "@/constants/Capture";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { fill, formatCoordinates } from "@/helpers/format";
import { toFileUri } from "@/services/storage/ImageStore";
import type { CapturedPhoto, PhotoQuality } from "@/types/Capture";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

/** The position the sheet shows: the locked asset's, else the phone's. */
export interface SheetPosition {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** True when this is the asset's projected position. */
  isAsset: boolean;
}

interface CaptureTrayProps {
  photos: CapturedPhoto[];
  /** GPS gate passed (or the surveyor chose to save a draft). */
  canCapture: boolean;
  /** Shutter label while locked; defaults to the GPS lock message. */
  lockedLabel?: string;
  isCapturing: boolean;
  /** Offer "save as draft" (GPS hasn't locked for a while). */
  offerDraft: boolean;
  position: SheetPosition | null;
  online: boolean;
  /** The line under the shutter; defaults to the photo count and checks. */
  note?: string | null;
  /** "Place by tap" (AR only); null hides it. */
  placeByTap?: { active: boolean; onPress: () => void } | null;
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

function PositionRow({
  position,
  online,
}: {
  position: SheetPosition | null;
  online: boolean;
}) {
  const s = strings.capture.sheet;
  const heading = position
    ? fill(position.isAsset ? s.assetPosition : s.yourPosition, {
        accuracy:
          position.accuracy === null ? "—" : position.accuracy.toFixed(1),
      })
    : s.waitingForFix;
  return (
    <View className="flex-row items-center gap-3">
      <Icon name="pin" size={22} color={colors.gpsLocked} />
      <View className="flex-1 gap-0.5" accessible>
        <Text className="type-overline text-on-camera-muted">{heading}</Text>
        {position ? (
          <Text className="type-mono text-[15px] text-white">
            {formatCoordinates(
              position.latitude,
              position.longitude,
              5,
              s.coordinates,
            )}
          </Text>
        ) : null}
      </View>
      <View className="h-8 px-3 rounded-2xl bg-white/10 items-center justify-center">
        <Text
          className={`type-chip ${online ? "text-on-camera-muted" : "text-gps-locked"}`}
        >
          {online ? s.online : s.offline}
        </Text>
      </View>
    </View>
  );
}

/**
 * The capture sheet (design/screens/Camera.png): where the record will be
 * placed, the photo slots, the shutter, "Place by tap" and the note under
 * them. Once a photo is taken, Continue opens the detection review.
 */
export function CaptureTray({
  photos,
  canCapture,
  lockedLabel = strings.capture.shutterLocked,
  isCapturing,
  offerDraft,
  position,
  online,
  note,
  placeByTap,
  onCapture,
  onRetake,
  onContinue,
  onSaveDraft,
}: CaptureTrayProps) {
  const full = photos.length >= MAX_PHOTOS;
  const shutterEnabled = canCapture && !isCapturing && !full;
  const s = strings.capture.sheet;

  return (
    <View className="bg-camera-sheet border-t border-camera-sheet-border rounded-t-[22px] px-5 pt-4 pb-safe-offset-3 gap-3">
      <PositionRow position={position} online={online} />

      <View className="flex-row items-center justify-between">
        <View
          accessibilityLabel={fill(strings.capture.photosTaken, {
            count: photos.length,
          })}
          className="w-[112px] gap-1.5"
        >
          <Text className="type-overline text-on-camera-muted">
            {fill(s.photos, { count: photos.length })}
          </Text>
          <View className="flex-row gap-1.5">
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
                  className="w-8 h-10 rounded-md overflow-hidden active:opacity-80"
                >
                  <Image
                    source={{ uri: toFileUri(photo.imageUri) }}
                    className="w-full h-full"
                  />
                </Pressable>
              ) : (
                <View
                  key={i}
                  className="w-8 h-10 rounded-md border-[1.5px] border-dashed border-white/40"
                />
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={onCapture}
          disabled={!shutterEnabled}
          accessibilityRole="button"
          accessibilityLabel={
            canCapture ? strings.capture.shutter : lockedLabel
          }
          accessibilityState={{ disabled: !shutterEnabled, busy: isCapturing }}
          className={`w-[84px] h-[84px] rounded-full border-[5px] items-center justify-center ${canCapture ? "border-gps-locked" : "border-white/35"}`}
        >
          <View
            className={`w-[64px] h-[64px] rounded-full items-center justify-center ${canCapture ? "bg-white active:opacity-80" : "bg-white/20"}`}
          >
            {isCapturing ? (
              <ActivityIndicator colorClassName="accent-camera" />
            ) : canCapture ? null : (
              <Icon name="lock" size={24} color={colors.surface} />
            )}
          </View>
        </Pressable>

        <View className="w-[112px] items-center gap-1.5">
          {placeByTap ? (
            <>
              <Pressable
                onPress={placeByTap.onPress}
                accessibilityRole="button"
                accessibilityState={{ selected: placeByTap.active }}
                accessibilityLabel={
                  placeByTap.active ? s.cancelPlacing : s.placeByTap
                }
                className={`w-[52px] h-[52px] rounded-full border items-center justify-center active:opacity-80 ${placeByTap.active ? "bg-gps-locked border-gps-locked" : "border-white/40"}`}
              >
                <Icon
                  name="crosshair"
                  size={24}
                  color={placeByTap.active ? colors.camera : colors.surface}
                />
              </Pressable>
              <Text className="type-caption text-on-camera-muted">
                {placeByTap.active ? s.cancelPlacing : s.placeByTap}
              </Text>
            </>
          ) : (
            <Text className="type-caption text-on-camera-muted text-center">
              {canCapture
                ? strings.capture.shutterNoteReady
                : strings.capture.shutterNoteLocked}
            </Text>
          )}
        </View>
      </View>

      <View className="min-h-11 flex-row items-center gap-3">
        {!canCapture && offerDraft ? (
          <Pressable
            onPress={onSaveDraft}
            accessibilityRole="button"
            className="flex-1 min-h-11 justify-center"
          >
            <Text className="font-body-semi text-[14px] text-white underline text-center">
              {strings.capture.saveDraft}
            </Text>
          </Pressable>
        ) : (
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 type-body-small text-on-camera-muted text-center"
          >
            {note ?? statusLine(photos)}
          </Text>
        )}
        {photos.length > 0 ? (
          <Pressable
            onPress={onContinue}
            disabled={isCapturing}
            accessibilityRole="button"
            className="px-5 h-11 rounded-pill-button bg-primary items-center justify-center active:bg-primary-pressed disabled:opacity-40"
          >
            <Text className="type-body-strong text-on-primary">
              {strings.capture.continue}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
