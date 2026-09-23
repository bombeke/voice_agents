import type { MenuItem } from "../MenuConfig";
import { filterMenu } from "../MenuFilter";

const item = (key: string, extra: Partial<MenuItem> = {}): MenuItem => ({
  key,
  title: key,
  href: `/${key}`,
  icon: "home",
  ...extra,
});

const keys = (items: MenuItem[]) => items.map((i) => i.key);
const operator = { isAdmin: false, claims: { permissions: ["agents:view"] } };

describe("filterMenu", () => {
  it("keeps items with no restrictions", () => {
    expect(keys(filterMenu([item("home")], operator))).toEqual(["home"]);
  });

  it("hides admin-only items from non-admins", () => {
    const menu = [item("admin", { requireAdmin: true })];
    expect(filterMenu(menu, operator)).toEqual([]);
    expect(keys(filterMenu(menu, { ...operator, isAdmin: true }))).toEqual([
      "admin",
    ]);
  });

  it("hides items whose permission is missing", () => {
    const menu = [
      item("agents", { permission: "agents:view" }),
      item("roads", { permission: "roads:view" }),
    ];
    expect(keys(filterMenu(menu, operator))).toEqual(["agents"]);
  });

  it("hides offline-invisible items only in offline-readonly mode", () => {
    const menu = [item("sync", { offlineVisible: false })];
    expect(
      filterMenu(menu, { ...operator, adminMode: "offline-readonly" }),
    ).toEqual([]);
    expect(
      keys(filterMenu(menu, { ...operator, adminMode: "online" })),
    ).toEqual(["sync"]);
  });

  it("filters children and drops parents left with none", () => {
    const menu = [
      item("admin", {
        children: [
          item("users", { permission: "admin:users:read" }),
          item("agents", { permission: "agents:view" }),
        ],
      }),
      item("empty", { children: [item("x", { requireAdmin: true })] }),
    ];
    const result = filterMenu(menu, operator);
    expect(keys(result)).toEqual(["admin"]);
    expect(keys(result[0].children!)).toEqual(["agents"]);
  });

  it("does not mutate the input", () => {
    const menu = [
      item("admin", { children: [item("x", { requireAdmin: true })] }),
    ];
    const snapshot = JSON.stringify(menu);
    filterMenu(menu, operator);
    expect(JSON.stringify(menu)).toBe(snapshot);
  });
});
