import { Button } from "@/components/ui/Button";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

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

  if (!agent)
    return <Text className="p-4 type-body text-text-muted">Loading...</Text>;

  return (
    <View className="flex-1 gap-4 p-4 bg-background">
      <Text className="type-h1 text-text">{agent.name}</Text>
      <Text className="type-body text-text">{agent.description}</Text>
      <Button onPress={() => alert("Demo: trigger agent run")}>
        Run Agent
      </Button>
    </View>
  );
}
