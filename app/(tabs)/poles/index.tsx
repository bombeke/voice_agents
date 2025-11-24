import { Link } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "tamagui";

export default function PolesIndex() {
  return (
    <View style={{ padding: 16 }} className="gap-4">
      <Text className="text-2xl font-semibold">AI Poles</Text>
      <Link href="/poles/capture" asChild>
        <Button>Capture Pole</Button>
      </Link>
      <Link href="/poles/maps" asChild>
        <Button>Dashboard Maps</Button>
      </Link>
      <Text className="mt-4">
        Pole Distribution
      </Text>
    </View>
  );
}
