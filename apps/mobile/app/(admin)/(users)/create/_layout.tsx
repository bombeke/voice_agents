import { RequirePermission } from "@/components/RequirePermission";

export default function CreateUserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequirePermission
      permission="admin:users:write"
      fallback="/(admin)/users"
      allowOfflineReadonly={false}
    >
      {children}
    </RequirePermission>
  );
}
