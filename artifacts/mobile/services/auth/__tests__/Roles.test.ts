import { effectivePermissions, rolePermissions } from "../Roles";

describe("rolePermissions", () => {
  it("gives an enumerator their own records and review status", () => {
    expect(rolePermissions("enumerator")).toEqual([
      "records:read:own",
      "records:capture",
      "review:read:own",
    ]);
  });

  it("gives a supervisor everything an enumerator has, plus the team", () => {
    const perms = rolePermissions("supervisor");
    expect(perms).toEqual(
      expect.arrayContaining(rolePermissions("enumerator")),
    );
    expect(perms).toEqual(
      expect.arrayContaining(["records:read:team", "records:review"]),
    );
    expect(perms).not.toContain("admin:read");
  });

  it("gives an admin everything", () => {
    expect(rolePermissions("admin")).toEqual(
      expect.arrayContaining([
        ...rolePermissions("supervisor"),
        "admin:read",
        "admin:users:read",
        "admin:policies:read",
      ]),
    );
  });
});

describe("effectivePermissions", () => {
  it("merges the token's permissions with those its roles imply", () => {
    expect(
      effectivePermissions({
        roles: ["enumerator"],
        permissions: ["agents:view"],
      }),
    ).toEqual(
      expect.arrayContaining([
        "agents:view",
        "records:read:own",
        "review:read:own",
      ]),
    );
  });

  it("ignores unknown roles and lists each permission once", () => {
    const perms = effectivePermissions({
      roles: ["analyst", "supervisor"],
      permissions: ["records:review"],
    });
    expect(perms.filter((p) => p === "records:review")).toHaveLength(1);
    expect(perms).toContain("records:read:own");
  });

  it("is empty without claims", () => {
    expect(effectivePermissions(null)).toEqual([]);
    expect(effectivePermissions({})).toEqual([]);
  });
});
