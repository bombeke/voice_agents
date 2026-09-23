import { Button } from "@/components/ui/Button";
import { Routes } from "@/services/Routes";
import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function PolesIndex() {
  return (
    <View className="flex-1 gap-4 p-4 bg-background">
      <Text className="type-h1 text-text">PoleVision™ Dashboard</Text>
      <View className="w-full gap-3">
        <Link
          href={{ pathname: Routes.CAPTURE, params: { category: "energy" } }}
          asChild
        >
          <Button>Scan Tags</Button>
        </Link>
        <Link href={Routes.MAP} asChild>
          <Button>Map</Button>
        </Link>
      </View>
    </View>
  );
}
