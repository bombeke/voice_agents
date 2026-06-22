export type AccessRule = {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  permission?: string;
  allowOfflineReadonly?: boolean;
  fallback?: string;
};

export const ACCESS_CONTROL: Record<string, AccessRule> = {
  "(tabs)": {
    requireAuth: true,
    fallback: "/(auth)/login",
  },
  "(tabs)/index": {
      requireAuth: true,
      fallback: "/(auth)/login",
    },
  "(admin)": {
    requireAuth: true,
    requireAdmin: true,
    fallback: "/(tabs)",
  },

  "(admin)/users": {
    permission: "admin:users:read",
    fallback: "/(admin)",
    allowOfflineReadonly: true,
  },

  "(admin)/users/create": {
    permission: "admin:users:write",
    fallback: "/(admin)/users",
  },

  "(admin)/policies": {
    permission: "admin:policies:read",
    fallback: "/(admin)",
  },
};
