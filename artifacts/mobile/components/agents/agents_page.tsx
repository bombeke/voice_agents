import { useState } from "react";

import { AssetCall } from "@/components/agents/AssetCall";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Input } from "@/components/ui/Input";

export default function AgentsScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  return (
    <ParallaxScrollView headerClassName="bg-primary-soft" headerImage={null}>
      <ThemedView className="flex-row items-center gap-2">
        <ThemedText type="title">AI Agents</ThemedText>
      </ThemedView>
      <ThemedView className="gap-2 mb-2">
        <ThemedText type="subtitle">List of Agents</ThemedText>
        <Input
          className="m-2"
          accessibilityRole="search"
          returnKeyType="search"
          placeholder="Search Agents"
          onChangeText={setSearchQuery}
          value={searchQuery}
        />
      </ThemedView>
      <ThemedView className="gap-2 mb-2">
        <AssetCall />
      </ThemedView>
    </ParallaxScrollView>
  );
}
