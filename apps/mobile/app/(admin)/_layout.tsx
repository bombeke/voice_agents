import AppTabs from "@/components/AppTabs";
import { GuardedLayout } from "@/components/auth/GuardedLayout";

export default function AdminLayout() {
  return (
    <GuardedLayout>
      <AppTabs />
    </GuardedLayout>
  );
}
