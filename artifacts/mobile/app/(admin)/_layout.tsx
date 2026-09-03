import { GuardedLayout } from "@/components/auth/GuardedLayout";
import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <GuardedLayout>
      <Stack screenOptions={{ headerShown: false }} />
    </GuardedLayout>
  );
}
