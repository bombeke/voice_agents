import { RequirePermission } from "@/components/RequirePermission";
import { Stack } from "expo-router";

export default function UsersAdminLayout() {
  return (
    <RequirePermission
      permission="admin:users:read"
      fallback="/(admin)"
      allowOfflineReadonly={true}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </RequirePermission>
  );
}
