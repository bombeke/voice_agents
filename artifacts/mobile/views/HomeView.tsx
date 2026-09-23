import { CategoryTile } from "@/components/home/CategoryTile";
import { HomeHeader } from "@/components/home/HomeHeader";
import { LastCapturedCard } from "@/components/home/LastCapturedCard";
import { TodayStatsCard } from "@/components/home/TodayStatsCard";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { useCaptureSummary } from "@/hooks/useCaptureSummary";
import { useAuth } from "@/providers/AuthProvider";
import { Routes } from "@/services/Routes";
import type { CaptureCategory, CaptureSummary } from "@/types/Capture";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

/** Home / Capture tab: today's progress, sync state and the category picker. */
export function HomeView() {
  const router = useRouter();
  const { org } = useAuth();
  const { stats, latest, gnss } = useCaptureSummary();

  const startCapture = (category: CaptureCategory) =>
    router.push({ pathname: Routes.CAPTURE, params: { category } });
  const openPending = () =>
    router.navigate({
      pathname: Routes.RECORDS,
      params: { filter: "pending" },
    });
  const openRecord = ({ id }: CaptureSummary) =>
    router.navigate({ pathname: Routes.RECORDS, params: { id } });

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="pt-safe-offset-6 pb-10 px-5 gap-3"
      showsVerticalScrollIndicator={false}
    >
      <HomeHeader
        org={org}
        pendingCount={stats.pending}
        onPendingPress={openPending}
        onProfilePress={() => router.navigate(Routes.PROFILE)}
      />

      <TodayStatsCard stats={stats} gnss={gnss} />

      <Text accessibilityRole="header" className="type-h1 text-text mt-3">
        {strings.home.heading}
      </Text>

      <View className="flex-row gap-3">
        <CategoryTile category="energy" onPress={startCapture} />
        <CategoryTile category="water" onPress={startCapture} />
      </View>
      <View className="flex-row gap-3">
        <CategoryTile category="telecom" onPress={startCapture} />
        <CategoryTile category="roads" onPress={startCapture} />
      </View>

      <Card
        variant="dashed"
        onPress={() => startCapture("auto")}
        accessibilityLabel={strings.home.aiPick}
        className="flex-row items-center justify-center gap-2"
      >
        <Icon name="crosshair" size={18} color={colors.text} />
        <Text className="type-body-strong text-text">
          {strings.home.aiPick}
        </Text>
      </Card>

      <View className="mt-2">
        <LastCapturedCard capture={latest} onPress={openRecord} />
      </View>
    </ScrollView>
  );
}
