import { useMMKVValue } from "@/hooks/useMMKVVlaue";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Text } from "react-native";
import { Button, Text as GText, View } from "tamagui";

export default function AgentsIndex() {
  const [agents, setAgents] = useState<any[]>([]);
  const [data,_] = useMMKVValue('data','')

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("agents");
      if (raw) setAgents(JSON.parse(raw));
    })();
  }, []);

  return (
    <View style={{ padding: 16 }} className="gap-4">
      <View className="flex-row justify-between items-center">
        <Text className="text-2xl font-semibold">AI Agents</Text>
        <Link href="/agents/create" asChild>
          <Button>New Agent</Button>
        </Link>
      </View>

      <FlatList
        data={agents}
        keyExtractor={(i) => i.id}
        renderItem={({ item }: any) => (
          <View className="p-3 border rounded-md mb-2">
            <GText className="font-bold">{item.name}</GText>
            <GText className="text-sm">{item.description}</GText>
            <Link href={`/agents/${item.id }`} asChild>
              <Button variant="outlined">
                Open
              </Button>
            </Link>
          </View>
        )}
        ListEmptyComponent={() => <Text>No agents yet. Create an agent.</Text>}
      />
      <View>
        <Text>{ data} </Text>
      </View>
    </View>
  );
}
