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
  REGISTER: { pathname: "/(auth)/register" } as const,
  SETTINGS: "/(tabs)/settings" as const,

  // App tabs
  TABS: "/(tabs)" as const,
  HOME: "/(tabs)" as const,
  MAP: "/(tabs)/map" as const,
  RECORDS: "/(tabs)/records" as const,
  REVIEW: "/(tabs)/review" as const,
  /** The Profile tab is the settings screen. */
  PROFILE: "/(tabs)/settings" as const,
  AGENTS: "/(tabs)/agents" as const,

  // Full-screen capture stack; takes `?category=energy|water|telecom|roads|auto`.
  CAPTURE: "/capture" as const,
  /** Capture step 2 of 3: review the AI detections before tagging. */
  CAPTURE_REVIEW: "/capture/review" as const,
  /** Capture step 3 of 3: tag the asset and save the record. */
  CAPTURE_TAG: "/capture/tag" as const,

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
export type AdminRouteKey = keyof (typeof Routes)["ADMIN"];

export function navigateTo(
  route: typeof Routes.ADMIN.DASHBOARD,
  isAdmin: boolean,
) {
  if (!isAdmin && "__adminOnly" in route) {
    throw new Error("Cannot navigate to admin route without permission");
  }
  router.push(route.pathname as any);
}
