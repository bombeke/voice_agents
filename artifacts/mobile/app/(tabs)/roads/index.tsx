import { Button } from "@/components/ui/Button";
import { FlatList, Text, View } from "react-native";

const demoRoads = [
  { id: "r1", name: "Main St", traffic: "Moderate" },
  { id: "r2", name: "2nd Ave", traffic: "Light" },
];

export default function RoadsIndex() {
  return (
    <View className="flex-1 gap-4 p-4 bg-background">
      <Text className="type-h1 text-text">AI Roads & Traffic</Text>

      <FlatList
        data={demoRoads}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View className="p-4 mb-2.5 gap-2.5 bg-surface border border-border rounded-2xl">
            <Text className="type-title text-text">{item.name}</Text>
            <Text className="type-body-small text-text-muted">
              {item.traffic}
            </Text>
            <Button variant="secondary">Details</Button>
          </View>
        )}
      />
    </View>
  );
}
