import { GenericCall } from "@/components/agents/GenericCall";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

export default function TabTwoScreen() {
  return (
    <ParallaxScrollView>
      <ThemedView className="flex-row gap-2">
        <ThemedText type="title">Explore</ThemedText>
      </ThemedView>
      <ThemedView className="gap-2 mb-2">
        <GenericCall />
      </ThemedView>
    </ParallaxScrollView>
  );
}
