import { FlatList, Text } from "react-native";
import { Button, View } from "tamagui";

const demoRoads = [
  { id: "r1", name: "Main St", traffic: "Moderate" },
  { id: "r2", name: "2nd Ave", traffic: "Light" },
];

export default function RoadsIndex() {
  return (
    <View style={{ padding: 16 }} className="gap-4">
      <Text className="text-2xl">AI Roads & Traffic</Text>

      <FlatList
        data={demoRoads}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View className="p-3 border rounded-md mb-2">
            <Text className="font-bold">{item.name}</Text>
            <Text>{item.traffic}</Text>
            <Button variant="outlined">
              Details
            </Button>
          </View>
        )}
      />
    </View>
  );
}
