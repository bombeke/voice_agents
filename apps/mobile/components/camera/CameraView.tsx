import { Picker } from "@react-native-picker/picker";
import { memo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  Camera,
  DrawableFrameProcessor,
  ReadonlyFrameProcessor,
} from "react-native-vision-camera";

interface Props {
  device: any;
  isActive: boolean;
  frameProcessor?: ReadonlyFrameProcessor | DrawableFrameProcessor;
  onInitialized: () => void;
  ref?: React.Ref<Camera | null>;

  selectedTag?: string;
  onTagChange?: (value: string) => void;

  comment?: string;
  onCommentChange?: (value: string) => void;

  error?: string;
}

export const CameraView = memo(
  ({
    device,
    isActive,
    frameProcessor,
    onInitialized,
    ref,
    selectedTag,
    onTagChange,
    comment,
    onCommentChange,
    error,
  }: Props) => {
    //if (!device) return null;

    return (
      <View style={styles.container}>
        <View
          style={styles.formContainer}
          className="px-4 pt-6 pb-4 space-y-4 z-10"
        >
          <View>
            <Text className="text-lg font-semibold text-foreground mb-2">
              Choose Tag
            </Text>

            <View className="bg-white rounded-xl overflow-hidden">
              <Picker selectedValue={selectedTag} onValueChange={onTagChange}>
                <Picker.Item label="Select a tag..." value="" />
                <Picker.Item label="Damaged Pole" value="damaged" />
                <Picker.Item label="Leaning Pole" value="leaning" />
                <Picker.Item label="Broken Line" value="broken_line" />
                <Picker.Item label="Other" value="other" />
              </Picker>
            </View>
          </View>

          <View>
            <Text className="text-lg font-semibold text-foreground mb-2">
              Comment
            </Text>

            <TextInput
              value={comment}
              onChangeText={onCommentChange}
              placeholder="Add additional notes..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-white rounded-xl px-4 py-3 min-h-[100px]"
            />
          </View>

          {/* Validation Error */}
          {error ? (
            <Text className="text-red-500 font-medium">{error}</Text>
          ) : null}
        </View>
        <View style={styles.cameraWrapper}>
          <Camera
            ref={ref}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isActive}
            photo={true}
            video={true}
            audio={false}
            preview={true}
            enableZoomGesture
            frameProcessor={frameProcessor}
            onInitialized={onInitialized}
            androidPreviewViewType="surface-view"
          />
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000", // Ensures preview always has visible base
  },
  formContainer: {
    padding: 16,
    backgroundColor: "#fff",
    zIndex: 10,
  },
  cameraWrapper: {
    flex: 1,
    backgroundColor: "#000", // Forces preview background visible
    overflow: "hidden",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
  },
  error: {
    color: "red",
    marginTop: 8,
    fontWeight: "500",
  },
});
