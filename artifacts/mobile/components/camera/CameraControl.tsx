import { memo } from "react";
import { Pressable, Text, View } from "react-native";

interface Props {
  onCapture: () => void;
  disabled: boolean;
}

export const CameraControls = memo(({ onCapture, disabled }: Props) => {
  return (
    <View className="absolute bottom-10 w-full items-center z-10">
      <Pressable
        className="w-20 h-20 rounded-full bg-primary justify-center items-center active:bg-primary-pressed disabled:opacity-40"
        onPress={onCapture}
        disabled={disabled}
      >
        <Text className="type-label text-on-primary">CAPTURE</Text>
      </Pressable>
    </View>
  );
});
