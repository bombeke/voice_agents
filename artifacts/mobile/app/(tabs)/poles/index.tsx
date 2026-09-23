import { Button } from "@/components/ui/Button";
import { Link } from "expo-router";
import { Text, View } from "react-native";
import DashboardMaps from "./maps";

export default function PolesIndex() {
  return (
    <View className="flex-1 gap-4 p-4 bg-background">
      <Text className="type-h1 text-text">PoleVision™ Dashboard</Text>
      <View className="w-full gap-3">
        <Link href="/poles/capture" asChild>
          <Button>Scan Tags</Button>
        </Link>
        <Link href="/poles/maps" asChild>
          <Button>Dashboard</Button>
        </Link>
      </View>
      <DashboardMaps />
    </View>
  );
}
