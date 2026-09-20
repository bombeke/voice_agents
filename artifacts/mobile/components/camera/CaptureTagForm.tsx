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
  StyleSheet,
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
          style={styles.backdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetContent}
            >
              <View style={styles.handle} />

              <View style={styles.preview}>
                {capture ? (
                  <Image
                    source={{ uri: toFileUri(capture.imageUri) }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : null}
                <View style={styles.previewMeta}>
                  <Text style={styles.previewTitle}>
                    {detected === 1
                      ? "1 pole detected"
                      : `${detected} poles detected`}
                  </Text>
                  {capture ? (
                    <Text style={styles.previewDetail}>
                      {capture.latitude.toFixed(5)},{" "}
                      {capture.longitude.toFixed(5)}
                    </Text>
                  ) : null}
                  {capture?.accuracy != null ? (
                    <Text style={styles.previewDetail}>
                      GPS ±{capture.accuracy.toFixed(1)} m
                    </Text>
                  ) : null}
                </View>
              </View>

              <Text style={styles.label}>Choose Tag</Text>
              <View style={styles.pickerWrapper}>
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

              <Text style={styles.label}>Comment</Text>
              <TextInput
                value={comment}
                onChangeText={setComment}
                editable={!isSaving}
                placeholder="Add additional notes..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={styles.input}
              />

              <View style={styles.actions}>
                <Pressable
                  style={[styles.button, styles.secondary]}
                  onPress={handleRetake}
                  disabled={isSaving}
                >
                  <Text style={styles.secondaryText}>Retake</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.button,
                    styles.primary,
                    (!tag || isSaving) && styles.disabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!tag || isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>Save & Upload</Text>
                  )}
                </Pressable>
              </View>

              {!tag ? (
                <Text style={styles.hint}>Pick a tag to enable saving.</Text>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  },
);

CaptureTagForm.displayName = "CaptureTagForm";

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: 16,
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
  },
  previewMeta: {
    flex: 1,
    marginLeft: 12,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  previewDetail: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 100,
    color: "#111827",
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  primary: {
    backgroundColor: "#2196F3",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondary: {
    backgroundColor: "#f3f4f6",
  },
  secondaryText: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 16,
  },
  disabled: {
    opacity: 0.45,
  },
  hint: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 12,
  },
});
