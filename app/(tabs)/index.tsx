import { ScrollView, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} className="bg-white">
      <View className="gap-4">
        <Text className="text-3xl font-bold text-primary">
          BYOD Environment AI Toolkit
        </Text>
        <Text className="text-base">
          Manage AI Agents for Disease Surveillance and Response, Pole defects and pollution, 
          sanitation and roads & traffic reporting.
        </Text>
      </View>
    </ScrollView>
  );
}
