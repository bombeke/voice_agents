import { FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { colors } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";

type RowProps = {
  icon: string;
  label: string;
  value?: string;
  iconColor?: string;
};

function InfoRow({
  icon,
  label,
  value,
  iconColor = colors.textMuted,
}: RowProps) {
  return (
    <View className="flex-row items-center py-3.5 px-4 gap-3.5 border-b border-surface-muted min-h-[52px]">
      <View className="w-[34px] h-[34px] rounded-tile bg-surface-muted items-center justify-center">
        <FontAwesome name={icon as any} size={15} color={iconColor} />
      </View>
      <Text className="flex-1 type-label text-text">{label}</Text>
      {value ? (
        <Text className="type-mono text-[13px] text-text-muted">{value}</Text>
      ) : null}
    </View>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <Text className={`type-overline text-text-muted ml-5 mb-2 ${className}`}>
      {children}
    </Text>
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
      className="flex-1 bg-background"
      contentContainerClassName="pb-10"
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card */}
      <View className="bg-surface border border-border m-4 rounded-2xl p-5">
        <View className="flex-row items-center gap-4">
          <View className="w-[58px] h-[58px] rounded-full bg-primary-soft items-center justify-center">
            <FontAwesome name="user" size={26} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="type-title text-text" numberOfLines={1}>
              {claims?.sub ?? "User"}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-1">
              {isAdmin ? (
                <View className="flex-row items-center gap-1 bg-primary-soft px-2.5 h-[26px] rounded-full">
                  <FontAwesome name="shield" size={10} color={colors.primary} />
                  <Text className="type-chip text-primary">Administrator</Text>
                </View>
              ) : (
                <View className="bg-surface-muted px-2.5 h-[26px] justify-center rounded-full">
                  <Text className="type-chip text-text-muted">Operator</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Account info */}
      <SectionLabel className="mt-1">Account</SectionLabel>
      <View className="bg-surface border border-border mx-4 rounded-2xl overflow-hidden">
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
          iconColor={isAdmin ? colors.primary : colors.textMuted}
        />
      </View>

      {/* Sign out */}
      <SectionLabel className="mt-6">Session</SectionLabel>
      <View className="bg-surface border border-border mx-4 rounded-2xl overflow-hidden">
        <Pressable
          onPress={handleLogout}
          className="flex-row items-center py-4 px-4 gap-3.5 bg-surface active:bg-danger-soft"
        >
          <View className="w-[34px] h-[34px] rounded-tile bg-danger-soft items-center justify-center">
            <FontAwesome name="sign-out" size={15} color={colors.danger} />
          </View>
          <Text className="type-body-strong text-danger">Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
