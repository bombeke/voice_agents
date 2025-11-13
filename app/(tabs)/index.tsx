import { ScrollView, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} className="bg-white">
      <View className="gap-4">
        <Text className="text-3xl font-bold text-primary">
          Welcome to AI Field Toolkit
        </Text>
        <Text className="text-base">
          This demo app showcases AI Agents management, pole capture & a simple
          demo ML flow, sanitation reporting forms and roads & traffic assets.
        </Text>
      </View>
    </ScrollView>
  );
}
