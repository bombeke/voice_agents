import { Routes } from "@/services/Routes";
import { FontAwesome } from "@expo/vector-icons";
import { ReactNode } from "react";

export type MenuItem = {
  key: string;
  title: string;
  route: string;
  icon: ReactNode;
  permission?: string;
  requireAdmin?: boolean;
  offlineVisible?: boolean;
  children?: MenuItem[];
};

export const MENU_CONFIG: MenuItem[] = [
  {
    key: "home",
    title: "Home",
    route: Routes.TABS,
    icon: <FontAwesome name="home" size={18} />,
  },

  {
    key: "agents",
    title: "Agents",
    route: "/agents",
    icon: <FontAwesome name="user" size={18} />,
    permission: "agents:view",
  },

  {
    key: "poles",
    title: "Poles",
    route: "/poles",
    icon: <FontAwesome name="camera" size={18} />,
  },

  {
    key: "sanitation",
    title: "Sanitation",
    route: "/sanitation",
    icon: <FontAwesome name="recycle" size={18} />,
  },

  {
    key: "roads",
    title: "Roads",
    route: "/roads",
    icon: <FontAwesome name="road" size={18} />,
  },

  {
    key: "admin",
    title: "Admin",
    route: Routes.ADMIN.DASHBOARD.pathname,
    icon: <FontAwesome name="shield" size={18} />,
    requireAdmin: true,
    permission: "admin:read",
    children: [
      {
        key: "users",
        title: "Users",
        route: "/users",
        icon: <FontAwesome name="users" size={18} />,
        permission: "admin:users:read",
      },
      {
        key: "policies",
        title: "Policies",
        route: "/policies",
        icon: <FontAwesome name="file-text" size={18} />,
        permission: "admin:policies:read",
      },
    ],
  },

  {
    key: "offline",
    title: "Offline",
    route: "/offline",
    icon: <FontAwesome name="wifi" size={18} />,
    offlineVisible: true,
  },

  {
    key: "settings",
    title: "Settings",
    route: "/settings",
    icon: <FontAwesome name="cog" size={18} />,
  },
];
