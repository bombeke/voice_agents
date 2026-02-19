import { Picker } from "@react-native-picker/picker";
import { memo } from "react";
import { Text, TextInput, View } from "react-native";
import { Camera } from "react-native-vision-camera";

interface Props {
  device: any;
  isActive: boolean;
  frameProcessor?: any;
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
    if (!device) return null;

    return (
      <View className="flex-1 bg-black">
        <View className="px-4 pt-6 pb-4 bg-background space-y-4 z-10">
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

        <Camera
          ref={ref}
          className="flex-1"
          device={device}
          isActive={isActive}
          photo={true}
          video={true}
          audio={false}
          enableZoomGesture
          frameProcessor={frameProcessor}
          onInitialized={onInitialized}
        />
      </View>
    );
  },
);
