import { Text, View } from "react-native";

export default function CameraScreen() {
  return (
    <View className="flex-1 items-center justify-center p-8 bg-background">
      <Text className="text-[64px] mb-4">📷</Text>
      <Text className="type-h2 text-text mb-3 text-center">Camera Capture</Text>
      <Text className="type-body text-text-muted text-center">
        Camera and AI detection are available on the mobile app.{"\n"}
        Open Expo Go on your Android or iOS device to use this feature.
      </Text>
    </View>
  );
}
