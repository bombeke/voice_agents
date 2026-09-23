import { PendingCapture } from "@/hooks/Types";
import { toFileUri } from "@/services/storage/ImageStore";
import { Picker } from "@react-native-picker/picker";
import { memo, useEffect, useState } from "react";
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

export const POLE_TAGS = [
  { label: "Damaged Pole", value: "damaged" },
  { label: "Leaning Pole", value: "leaning" },
  { label: "Broken Line", value: "broken_line" },
  { label: "Other", value: "other" },
] as const;

interface Props {
  capture: PendingCapture | null;
  isSaving: boolean;
  onSubmit: (values: { tag: string; comment: string }) => void;
  onRetake: () => void;
}

/**
 * Post-capture form. It opens over the live camera once a photo has been taken
 * and is the only way a capture reaches the store — dismissing it retakes the
 * shot rather than saving an untagged record.
 */
export const CaptureTagForm = memo(
  ({ capture, isSaving, onSubmit, onRetake }: Props) => {
    const [tag, setTag] = useState("");
    const [comment, setComment] = useState("");

    // Start each shot with an empty form. Clearing on submit instead would wipe
    // the surveyor's input if the save failed and the form stayed open to retry.
    useEffect(() => {
      if (capture) {
        setTag("");
        setComment("");
      }
    }, [capture]);

    const handleRetake = () => {
      if (isSaving) return;
      onRetake();
    };

    const handleSubmit = () => {
      if (!tag || isSaving) return;
      onSubmit({ tag, comment: comment.trim() });
    };

    const detected = capture?.detections.length ?? 0;

    return (
      <Modal
        visible={!!capture}
        animationType="slide"
        transparent
        onRequestClose={handleRetake}
      >
        <KeyboardAvoidingView
          className="flex-1 justify-end bg-black/55"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="max-h-[88%] bg-surface rounded-t-3xl">
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="px-5 pt-2.5 pb-7"
            >
              <View className="self-center w-10 h-1 rounded-xs bg-border-strong mb-4" />

              <View className="flex-row items-center mb-5">
                {capture ? (
                  <Image
                    source={{ uri: toFileUri(capture.imageUri) }}
                    className="w-[72px] h-[72px] rounded-xl bg-surface-muted"
                    resizeMode="cover"
                  />
                ) : null}
                <View className="flex-1 ml-3">
                  <Text className="type-body-strong text-text">
                    {detected === 1
                      ? "1 pole detected"
                      : `${detected} poles detected`}
                  </Text>
                  {capture ? (
                    <Text className="type-mono text-xs text-text-muted mt-0.5">
                      {capture.latitude.toFixed(5)},{" "}
                      {capture.longitude.toFixed(5)}
                    </Text>
                  ) : null}
                  {capture?.accuracy != null ? (
                    <Text className="type-mono text-xs text-text-muted mt-0.5">
                      GPS ±{capture.accuracy.toFixed(1)} m
                    </Text>
                  ) : null}
                </View>
              </View>

              <Text className="type-body-strong text-text mb-2">
                Choose Tag
              </Text>
              <View className="bg-surface border border-border-strong rounded-xl overflow-hidden mb-4">
                <Picker
                  enabled={!isSaving}
                  selectedValue={tag}
                  onValueChange={(value) => setTag(String(value))}
                >
                  <Picker.Item label="Select a tag..." value="" />
                  {POLE_TAGS.map((t) => (
                    <Picker.Item
                      key={t.value}
                      label={t.label}
                      value={t.value}
                    />
                  ))}
                </Picker>
              </View>

              <Text className="type-body-strong text-text mb-2">Comment</Text>
              <TextInput
                value={comment}
                onChangeText={setComment}
                editable={!isSaving}
                placeholder="Add additional notes..."
                placeholderTextColorClassName="accent-text-muted"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="bg-surface border border-border-strong rounded-xl px-4 py-3 min-h-[100px] type-body text-text mb-5 focus:border-2 focus:border-accent"
              />

              <View className="flex-row gap-3">
                <Pressable
                  className="flex-1 h-[52px] rounded-button justify-center items-center bg-surface border border-border-strong active:bg-surface-muted"
                  onPress={handleRetake}
                  disabled={isSaving}
                >
                  <Text className="type-body-strong text-text">Retake</Text>
                </Pressable>

                <Pressable
                  className="flex-1 h-[52px] rounded-button justify-center items-center bg-primary active:bg-primary-pressed disabled:opacity-45"
                  onPress={handleSubmit}
                  disabled={!tag || isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator colorClassName="accent-on-primary" />
                  ) : (
                    <Text className="type-body-strong text-on-primary">
                      Save & Upload
                    </Text>
                  )}
                </Pressable>
              </View>

              {!tag ? (
                <Text className="text-center type-caption text-text-muted mt-3">
                  Pick a tag to enable saving.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  },
);

CaptureTagForm.displayName = "CaptureTagForm";
