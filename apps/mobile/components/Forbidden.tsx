import { Text, View } from "react-native";

export function Forbidden() {
  return (
    <View className="flex-1 justify-center items-center p-6">
      <Text className="text-xl font-semibold">Access denied</Text>
      <Text className="text-gray-500 mt-2">
        You don’t have permission to view this page.
      </Text>
    </View>
  );
}
