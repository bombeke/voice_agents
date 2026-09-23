import { Button } from "@/components/ui/Button";
import { useMMKVValue } from "@/hooks/useMMKVVlaue";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";

export default function AgentsIndex() {
  const [agents, setAgents] = useState<any[]>([]);
  const [data, _] = useMMKVValue("data", "");

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("agents");
      if (raw) setAgents(JSON.parse(raw));
    })();
  }, []);

  return (
    <View className="flex-1 gap-4 p-4 bg-background">
      <View className="flex-row justify-between items-center">
        <Text className="type-h1 text-text">AI Agents</Text>
        <Link href="/agents/create" asChild>
          <Button>New Agent</Button>
        </Link>
      </View>

      <FlatList
        data={agents}
        keyExtractor={(i) => i.id}
        renderItem={({ item }: any) => (
          <View className="p-4 mb-2.5 gap-2.5 bg-surface border border-border rounded-2xl">
            <Text className="type-title text-text">{item.name}</Text>
            <Text className="type-body-small text-text-muted">
              {item.description}
            </Text>
            <Link href={`/agents/${item.id}`} asChild>
              <Button variant="secondary">Open</Button>
            </Link>
          </View>
        )}
        ListEmptyComponent={() => (
          <Text className="type-body text-text-muted">
            No agents yet. Create an agent.
          </Text>
        )}
      />
      <View>
        <Text className="type-body text-text">{data}</Text>
      </View>
    </View>
  );
}
