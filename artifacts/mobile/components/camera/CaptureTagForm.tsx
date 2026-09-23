import { Chip } from "@/components/ui/Chip";
import type { AssetCategory } from "@/constants/Colors";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import type { CaptureLocation, SaveArgs } from "@/hooks/useCaptureSession";
import { toFileUri } from "@/services/storage/ImageStore";
import type { CaptureCategory, CapturedPhoto } from "@/types/Capture";
import { Picker } from "@react-native-picker/picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

export const CAPTURE_TAGS = [
  "good",
  "fair",
  "poor",
  "damaged",
  "not_functional",
  "other",
] as const satisfies readonly (keyof typeof strings.capture.tags)[];

const CATEGORIES: AssetCategory[] = ["energy", "water", "telecom", "roads"];

interface CaptureTagFormProps {
  visible: boolean;
  photos: CapturedPhoto[];
  location: CaptureLocation | null;
  /** The camera's category; "auto" makes the surveyor pick one here. */
  category: CaptureCategory;
  /** Unique assets across the photos. */
  detectedCount: number;
  isSaving: boolean;
  onSubmit: (values: SaveArgs) => void;
  onBack: () => void;
}

/**
 * Post-capture form over the preview. It is the only way shots reach the
 * store; going back keeps the photos so another can be added or retaken.
 */
export function CaptureTagForm({
  visible,
  photos,
  location,
  category: cameraCategory,
  detectedCount,
  isSaving,
  onSubmit,
  onBack,
}: CaptureTagFormProps) {
  const [category, setCategory] = useState<AssetCategory | null>(null);
  const [tag, setTag] = useState("");
  const [comment, setComment] = useState("");

  // Start each opening from the camera's category and an empty form.
  useEffect(() => {
    if (visible) {
      setCategory(cameraCategory === "auto" ? null : cameraCategory);
      setTag("");
      setComment("");
    }
  }, [visible, cameraCategory]);

  const canSave = !!category && !!tag && !isSaving;
  const handleBack = () => {
    if (!isSaving) onBack();
  };
  const handleSubmit = () => {
    if (canSave && category)
      onSubmit({ category, tag, comment: comment.trim() });
  };

  const detectedText =
    detectedCount === 0
      ? strings.capture.form.detectionsNone
      : detectedCount === 1
        ? strings.capture.form.detectionsOne
        : fill(strings.capture.form.detections, { count: detectedCount });
  const draft = location?.flags.includes("gps_unverified") ?? false;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleBack}
    >
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/55"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="max-h-[88%] bg-surface rounded-t-3xl">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-5 pt-2.5 pb-safe-offset-7"
          >
            <View className="self-center w-10 h-1 rounded-xs bg-border-strong mb-4" />

            <View className="flex-row items-center mb-5 gap-3">
              <View className="flex-row gap-1.5">
                {photos.map((photo) => (
                  <Image
                    key={photo.imageUri}
                    source={{ uri: toFileUri(photo.imageUri) }}
                    className="w-14 h-14 rounded-xl bg-surface-muted"
                    resizeMode="cover"
                  />
                ))}
              </View>
              <View className="flex-1">
                <Text className="type-body-strong text-text">
                  {detectedText}
                </Text>
                {location ? (
                  <Text className="type-mono text-xs text-text-muted mt-0.5">
                    {location.latitude.toFixed(7)},{" "}
                    {location.longitude.toFixed(7)}
                  </Text>
                ) : null}
                {location?.accuracy != null ? (
                  <Text className="type-mono text-xs text-text-muted mt-0.5">
                    {fill(strings.capture.form.accuracy, {
                      accuracy: location.accuracy.toFixed(1),
                    })}
                  </Text>
                ) : null}
                {draft ? (
                  <Text className="type-caption text-warning mt-0.5">
                    {strings.capture.form.draft}
                  </Text>
                ) : null}
              </View>
            </View>

            <Text className="type-body-strong text-text mb-2">
              {strings.capture.form.category}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={strings.categories[c].label}
                  selected={category === c}
                  disabled={isSaving}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>

            <Text className="type-body-strong text-text mb-2">
              {strings.capture.form.status}
            </Text>
            <View className="bg-surface border border-border-strong rounded-xl overflow-hidden mb-4">
              <Picker
                enabled={!isSaving}
                selectedValue={tag}
                onValueChange={(value) => setTag(String(value))}
                accessibilityLabel={strings.capture.form.status}
              >
                <Picker.Item
                  label={strings.capture.form.statusPlaceholder}
                  value=""
                />
                {CAPTURE_TAGS.map((t) => (
                  <Picker.Item
                    key={t}
                    label={strings.capture.tags[t]}
                    value={t}
                  />
                ))}
              </Picker>
            </View>

            <Text className="type-body-strong text-text mb-2">
              {strings.capture.form.comment}
            </Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              editable={!isSaving}
              accessibilityLabel={strings.capture.form.comment}
              placeholder={strings.capture.form.commentPlaceholder}
              placeholderTextColorClassName="accent-text-muted"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-surface border border-border-strong rounded-xl px-4 py-3 min-h-[100px] type-body text-text mb-5 focus:border-2 focus:border-accent"
            />

            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 h-[52px] rounded-button justify-center items-center bg-surface border border-border-strong active:bg-surface-muted"
                onPress={handleBack}
                disabled={isSaving}
                accessibilityRole="button"
              >
                <Text className="type-body-strong text-text">
                  {strings.capture.form.retake}
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 h-[52px] rounded-button justify-center items-center bg-primary active:bg-primary-pressed disabled:opacity-45"
                onPress={handleSubmit}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityLabel={strings.capture.form.save}
                accessibilityState={{ disabled: !canSave, busy: isSaving }}
              >
                {isSaving ? (
                  <ActivityIndicator colorClassName="accent-on-primary" />
                ) : (
                  <Text className="type-body-strong text-on-primary">
                    {strings.capture.form.save}
                  </Text>
                )}
              </Pressable>
            </View>

            {!category || !tag ? (
              <Text className="text-center type-caption text-text-muted mt-3">
                {!category
                  ? strings.capture.form.pickCategory
                  : strings.capture.form.pickStatus}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
