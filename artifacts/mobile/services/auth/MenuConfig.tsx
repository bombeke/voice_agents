import { FontAwesome } from "@expo/vector-icons";
import { ComponentProps } from "react";

export type FontAwesomeName = ComponentProps<typeof FontAwesome>["name"];

export type MenuItem = {
  key: string;
  title: string;
  /**
   * Route name inside `app/(tabs)`. Only set for entries that are real tab
   * screens — it is what gets passed to `<Tabs.Screen name>`, so it must match
   * a file/directory under `app/(tabs)`.
   */
  tab?: string;
  /** Href used for navigation (dashboard cards, links). Must be a real route. */
  href: string;
  icon: FontAwesomeName;
  permission?: string;
  requireAdmin?: boolean;
  offlineVisible?: boolean;
  children?: MenuItem[];
  desc?: string;
  color?: string;
  bg?: string;
};

export const MENU_CONFIG: MenuItem[] = [
  {
    key: "index",
    title: "Home",
    tab: "index",
    href: "/(tabs)",
    icon: "home",
  },

  {
    key: "agents",
    title: "Agents",
    tab: "agents",
    href: "/(tabs)/agents",
    icon: "user",
    permission: "agents:view",
    desc: "Deploy disease surveillance agents",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },

  {
    key: "poles",
    title: "Poles",
    tab: "poles",
    href: "/(tabs)/poles",
    icon: "camera",
    desc: "AI-powered pole defect detection",
    color: "#2563EB",
    bg: "#EFF6FF",
  },

  {
    key: "sanitation",
    title: "Sanitation",
    tab: "sanitation",
    href: "/(tabs)/sanitation",
    icon: "recycle",
    desc: "Monitor sanitation conditions",
    color: "#059669",
    bg: "#ECFDF5",
  },

  {
    key: "roads",
    title: "Roads",
    tab: "roads",
    href: "/(tabs)/roads",
    icon: "road",
    desc: "Road condition analytics",
    color: "#D97706",
    bg: "#FFFBEB",
  },

  // TODO: `app/(admin)` currently contains only `_layout.tsx` files and no
  // screens, so it generates no routes at all — every admin href is a dead
  // link. Re-enable this entry once `app/(admin)/index.tsx` (and the users /
  // policies screens) exist.
  // {
  //   key: "admin",
  //   title: "Admin",
  //   href: "/(admin)",
  //   icon: "shield",
  //   requireAdmin: true,
  //   permission: "admin:read",
  //   children: [
  //     {
  //       key: "users",
  //       title: "Users",
  //       href: "/(admin)/users",
  //       icon: "users",
  //       permission: "admin:users:read",
  //     },
  //     {
  //       key: "policies",
  //       title: "Policies",
  //       href: "/(admin)/policies",
  //       icon: "file-text",
  //       permission: "admin:policies:read",
  //     },
  //   ],
  // },

  {
    key: "settings",
    title: "Settings",
    tab: "settings",
    href: "/(tabs)/settings",
    icon: "cog",
  },
];
