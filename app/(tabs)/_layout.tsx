import { FontAwesome } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: () => <FontAwesome name="home" size={18} />,
          }}
        />
        <Tabs.Screen
          name="agents"
          options={{
            title: "AI Agents",
            tabBarIcon: () => <FontAwesome name="user" size={18} />,
          }}
        />
        <Tabs.Screen
          name="poles"
          options={{
            title: "AI Poles",
            tabBarIcon: () => <FontAwesome name="camera" size={18} />,
          }}
        />
        <Tabs.Screen
          name="sanitation"
          options={{
            title: "AI Sanitation",
            tabBarIcon: () => <FontAwesome name="recycle" size={18} />,
          }}
        />
        <Tabs.Screen
          name="roads"
          options={{
            title: "AI Roads",
            tabBarIcon: () => <FontAwesome name="road" size={18} />,
          }}
        />
    </Tabs>
  );
}
