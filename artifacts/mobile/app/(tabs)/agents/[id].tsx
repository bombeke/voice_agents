import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "tamagui";

export default function AgentDetail() {
  const { id } = useLocalSearchParams();
  const [agent, setAgent] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("agents");
      if (!raw) return;
      const list = JSON.parse(raw);
      setAgent(list.find((a: any) => a.id === id));
    })();
  }, [id]);

  if (!agent) return <Text>Loading...</Text>;

  return (
    <View style={{ padding: 16 }} className="gap-4">
      <Text className="text-2xl font-bold">{agent.name}</Text>
      <Text>{agent.description}</Text>
      <Button onPress={() => alert("Demo: trigger agent run")}>
        Run Agent
      </Button>
    </View>
  );
}
