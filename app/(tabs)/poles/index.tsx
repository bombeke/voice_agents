import { Link } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "tamagui";
import DashboardMaps from "./maps";

export default function PolesIndex() {
  return (
    <View style={{ padding: 16 }} className="gap-4">
      <Text className="text-2xl font-semibold">PoleVision™ Dashboard</Text>
      <View className="flex w-full gap-3">
        <Link href="/poles/capture" asChild>
          <Button>Scan Pole</Button>
        </Link>
        <Link href="/poles/maps" asChild>
          <Button>Dashboard</Button>
        </Link>
      </View>
      <DashboardMaps/>
    </View>
  );
}
