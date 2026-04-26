/**
 * routes.ts
 *
 * Central, type-safe route map for Expo Router
 * Used for:
 *   - Redirects
 *   - Tab definitions
 *   - Policy-driven navigation
 *   - Deep-link safe navigation
 */

import { router } from "expo-router";

export type RouteObject = { pathname: string };

export type AdminRoute = RouteObject & { __adminOnly: true };

// Admin route factory for type-safe branding
export function adminRoute(pathname: `/(admin)/${string}`): AdminRoute {
  return { pathname, __adminOnly: true };
}

// Main route map
export const Routes = {
  // Public
  ROOT: "/" as const,
  LOGIN: { pathname: "/(auth)/login" } as const,
  SETTINGS: "/(tabs)/settings" as const,

  // App tabs
  TABS: "/(tabs)" as const,
  HOME: "/(tabs)/index" as const,
  AGENTS: "/(tabs)/agents" as const,

  // Admin
  ADMIN: {
    DASHBOARD: adminRoute("/(admin)/dashboard"),
    USERS: adminRoute("/(admin)/users"),
    POLICIES: adminRoute("/(admin)/policies"),
  },

  // Offline / fallback
  OFFLINE: "/(tabs)/offline" as const,
} as const;

// Helper types for typed navigation
export type PublicRouteKey = keyof typeof Routes;
export type AdminRouteKey = keyof typeof Routes["ADMIN"];

export function navigateTo(route: typeof Routes.ADMIN.DASHBOARD, isAdmin: boolean) {
  if (!isAdmin && "__adminOnly" in route) {
    throw new Error("Cannot navigate to admin route without permission");
  }
  router.push(route.pathname as any);
}
