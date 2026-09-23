import { Text, View } from "react-native";

export function Forbidden() {
  return (
    <View className="flex-1 justify-center items-center p-6 bg-background">
      <Text className="type-title text-text">Access denied</Text>
      <Text className="type-body text-text-muted mt-2">
        You don’t have permission to view this page.
      </Text>
    </View>
  );
}
