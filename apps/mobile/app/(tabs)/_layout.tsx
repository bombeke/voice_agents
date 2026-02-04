import AppTabs from "@/components/AppTabs";
import { GuardedLayout } from "@/components/auth/GuardedLayout";

export default function TabsLayout() {
  return (
    <GuardedLayout>
      <AppTabs />
    </GuardedLayout>
  );
}
