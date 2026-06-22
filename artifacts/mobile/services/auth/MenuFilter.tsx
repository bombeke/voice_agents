import { hasPerm } from "@/services/auth/AuthUtils";
import { MenuItem } from "./MenuConfig";

type Context = {
  isAdmin: boolean;
  claims: any;
  adminMode?: "online" | "offline-readonly" | "disabled";
};

export function filterMenu(items: MenuItem[], ctx: Context): MenuItem[] {
  return items
    .filter((item) => {
      if (item.requireAdmin && !ctx.isAdmin) return false;

      if (item.permission && !hasPerm(ctx.claims, item.permission)) {
        return false;
      }

      if (
        ctx.adminMode === "offline-readonly" &&
        item.offlineVisible === false
      ) {
        return false;
      }

      return true;
    })
    .map((item) => ({
      ...item,
      children: item.children ? filterMenu(item.children, ctx) : undefined,
    }))
    .filter((item) => !item.children || item.children.length > 0);
}
