import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

const NATIVE_DRIVER = Platform.OS !== "web";

import { useAuth } from "@/providers/AuthProvider";

type Module = {
  icon: string;
  title: string;
  desc: string;
  color: string;
  bg: string;
  route: string;
};

const MODULES: Module[] = [
  {
    icon: "camera",
    title: "Pole Inspection",
    desc: "AI-powered pole defect detection",
    color: "#2563EB",
    bg: "#EFF6FF",
    route: "/poles",
  },
  {
    icon: "recycle",
    title: "Sanitation",
    desc: "Monitor sanitation conditions",
    color: "#059669",
    bg: "#ECFDF5",
    route: "/sanitation",
  },
  {
    icon: "road",
    title: "Roads & Traffic",
    desc: "Road condition analytics",
    color: "#D97706",
    bg: "#FFFBEB",
    route: "/roads",
  },
  {
    icon: "user",
    title: "AI Agents",
    desc: "Deploy disease surveillance agents",
    color: "#7C3AED",
    bg: "#F5F3FF",
    route: "/agents",
  },
];

function ModuleCard({ item }: { item: Module }) {
  const scale = useRef(new Animated.Value(1)).current;
  const router = useRouter();

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: NATIVE_DRIVER,
      speed: 50,
      bounciness: 4,
    }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: NATIVE_DRIVER,
      speed: 50,
      bounciness: 4,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => router.push(item.route as any)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 18,
          padding: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 2,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: item.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FontAwesome name={item.icon as any} size={22} color={item.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 3 }}
          >
            {item.title}
          </Text>
          <Text style={{ fontSize: 12, color: "#6B7280", lineHeight: 17 }}>
            {item.desc}
          </Text>
        </View>

        <FontAwesome name="chevron-right" size={12} color="#D1D5DB" />
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { claims, isAdmin } = useAuth();

  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      style={{ backgroundColor: "#F8FAFC" }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ marginBottom: 28 }}>
        <Text
          style={{
            fontSize: 12,
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: 1.2,
            fontWeight: "600",
          }}
        >
          BYOD Environment
        </Text>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: "#111827",
            marginTop: 4,
            letterSpacing: -0.5,
          }}
        >
          AI Toolkit
        </Text>
        {claims?.sub ? (
          <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 6 }}>
            Welcome back,{" "}
            <Text style={{ fontWeight: "600", color: "#374151" }}>
              {claims.sub}
            </Text>
            {isAdmin && " · Admin"}
          </Text>
        ) : null}
      </View>

      {/* Module cards */}
      <View>
        {MODULES.map((item) => (
          <ModuleCard key={item.title} item={item} />
        ))}
      </View>
    </ScrollView>
  );
}
