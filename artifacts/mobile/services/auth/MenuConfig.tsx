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
  desc?: string;
  color?: string;
  bg?: string;
};

export const MENU_CONFIG: MenuItem[] = [
  {
    key: "index",
    title: "Home",
    route: "/index",
    icon: <FontAwesome name="home" size={18} />,
  },

  {
    key: "agents",
    title: "Agents",
    route: "/agents",
    icon: <FontAwesome name="user" size={18} />,
    permission: "agents:view",
    desc: "Deploy disease surveillance agents",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },

  {
    key: "poles",
    title: "Poles",
    route: "/poles",
    icon: <FontAwesome name="camera" size={18} />,
    desc: "AI-powered pole defect detection",
    color: "#2563EB",
    bg: "#EFF6FF",
  },

  {
    key: "sanitation",
    title: "Sanitation",
    route: "/sanitation",
    icon: <FontAwesome name="recycle" size={18} />,
    desc: "Monitor sanitation conditions",
    color: "#059669",
    bg: "#ECFDF5",
  },

  {
    key: "roads",
    title: "Roads",
    route: "/roads",
    icon: <FontAwesome name="road" size={18} />,
    desc: "Road condition analytics",
    color: "#D97706",
    bg: "#FFFBEB",
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
    key: "settings",
    title: "Settings",
    route: "/settings",
    icon: <FontAwesome name="cog" size={18} />,
  },
];
