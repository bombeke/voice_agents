import type { IconName } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";

export type MenuItem = {
  key: string;
  title: string;
  /**
   * Route name inside `app/(tabs)`. Only set for entries that are real tab
   * screens — it is what gets passed to `<Tabs.Screen name>`, so it must match
   * a file/directory under `app/(tabs)`.
   */
  tab?: string;
  /** Href used for navigation. Must be a real route. */
  href: string;
  icon: IconName;
  permission?: string;
  requireAdmin?: boolean;
  offlineVisible?: boolean;
  children?: MenuItem[];
};

/** Bottom tabs from design-doc §4: Capture, Map, Records, Review, Profile. */
export const MENU_CONFIG: MenuItem[] = [
  {
    key: "index",
    title: strings.tabs.capture,
    tab: "index",
    href: "/(tabs)",
    icon: "capture",
  },
  {
    key: "map",
    title: strings.tabs.map,
    tab: "map",
    href: "/(tabs)/map",
    icon: "map",
  },
  {
    key: "records",
    title: strings.tabs.records,
    tab: "records",
    href: "/(tabs)/records",
    icon: "records",
  },
  {
    key: "review",
    title: strings.tabs.review,
    tab: "review",
    href: "/(tabs)/review",
    icon: "review",
    // Supervisors (and admins) only.
    permission: "records:review",
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
  //       icon: "user",
  //       permission: "admin:users:read",
  //     },
  //     {
  //       key: "policies",
  //       title: "Policies",
  //       href: "/(admin)/policies",
  //       icon: "records",
  //       permission: "admin:policies:read",
  //     },
  //   ],
  // },

  {
    key: "settings",
    title: strings.tabs.profile,
    tab: "settings",
    href: "/(tabs)/settings",
    icon: "user",
  },
];
