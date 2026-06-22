import { FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/providers/AuthProvider";

type RowProps = {
  icon: string;
  label: string;
  value?: string;
  iconColor?: string;
};

function InfoRow({ icon, label, value, iconColor = "#6B7280" }: RowProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
        gap: 14,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: "#F9FAFB",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FontAwesome name={icon as any} size={15} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, color: "#374151", fontWeight: "500" }}>
        {label}
      </Text>
      {value ? (
        <Text style={{ fontSize: 13, color: "#9CA3AF" }}>{value}</Text>
      ) : null}
    </View>
  );
}

export default function Settings() {
  const { claims, logout, isAdmin, org } = useAuth();

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          await logout();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F8FAFC" }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          margin: 16,
          borderRadius: 18,
          padding: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: "#EFF6FF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FontAwesome name="user" size={26} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 17, fontWeight: "700", color: "#111827" }}
              numberOfLines={1}
            >
              {claims?.sub ?? "User"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              {isAdmin ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: "#EFF6FF",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 20,
                  }}
                >
                  <FontAwesome name="shield" size={10} color="#2563EB" />
                  <Text style={{ fontSize: 11, color: "#2563EB", fontWeight: "700" }}>
                    Administrator
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: "#F3F4F6",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600" }}>
                    Operator
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Account info */}
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: "#9CA3AF",
          letterSpacing: 1,
          textTransform: "uppercase",
          marginLeft: 20,
          marginBottom: 8,
          marginTop: 4,
        }}
      >
        Account
      </Text>
      <View
        style={{
          backgroundColor: "#FFFFFF",
          marginHorizontal: 16,
          borderRadius: 18,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        {claims?.sub ? (
          <InfoRow icon="id-badge" label="User ID" value={claims.sub} />
        ) : null}
        {org ? (
          <InfoRow icon="building" label="Organisation" value={org} />
        ) : null}
        <InfoRow
          icon="lock"
          label="Role"
          value={isAdmin ? "Admin" : "Operator"}
          iconColor={isAdmin ? "#2563EB" : "#6B7280"}
        />
      </View>

      {/* Sign out */}
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: "#9CA3AF",
          letterSpacing: 1,
          textTransform: "uppercase",
          marginLeft: 20,
          marginBottom: 8,
          marginTop: 24,
        }}
      >
        Session
      </Text>
      <View
        style={{
          backgroundColor: "#FFFFFF",
          marginHorizontal: 16,
          borderRadius: 18,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 16,
            paddingHorizontal: 18,
            gap: 14,
            backgroundColor: pressed ? "#FFF1F2" : "#FFFFFF",
          })}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: "#FFF1F2",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FontAwesome name="sign-out" size={15} color="#EF4444" />
          </View>
          <Text
            style={{ fontSize: 15, color: "#EF4444", fontWeight: "600" }}
          >
            Sign Out
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
