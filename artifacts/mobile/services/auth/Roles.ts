import type { Claims } from "@/types/Auth";

/** What the UI lets a user see and do. The server still scopes the data. */
export const PERMISSIONS = {
  /** Own records in Records, on this device and from the server. */
  RECORDS_READ_OWN: "records:read:own",
  CAPTURE: "records:capture",
  /** Own records' review status in the Review tab. */
  REVIEW_READ_OWN: "review:read:own",
  /** Records of the enumerators assigned to this user. */
  RECORDS_READ_TEAM: "records:read:team",
  /** Download review batches and approve or reject records. */
  REVIEW_DECIDE: "records:review",
  ADMIN_READ: "admin:read",
  ADMIN_USERS_READ: "admin:users:read",
  ADMIN_POLICIES_READ: "admin:policies:read",
} as const;

export type Role = "enumerator" | "supervisor" | "admin";

const P = PERMISSIONS;

/** Each role's own permissions and the role it inherits from. */
const ROLES: Record<Role, { inherits?: Role; permissions: string[] }> = {
  enumerator: {
    permissions: [P.RECORDS_READ_OWN, P.CAPTURE, P.REVIEW_READ_OWN],
  },
  supervisor: {
    inherits: "enumerator",
    permissions: [P.RECORDS_READ_TEAM, P.REVIEW_DECIDE],
  },
  admin: {
    inherits: "supervisor",
    permissions: [P.ADMIN_READ, P.ADMIN_USERS_READ, P.ADMIN_POLICIES_READ],
  },
};

const isRole = (value: string): value is Role => value in ROLES;

/** A role's permissions, including everything the roles below it grant. */
export function rolePermissions(role: Role): string[] {
  const out: string[] = [];
  for (let r: Role | undefined = role; r; r = ROLES[r].inherits) {
    out.push(...ROLES[r].permissions);
  }
  return out;
}

/**
 * The server's permissions plus those the user's roles imply, so a supervisor
 * token that only lists "records:review" still sees their own records.
 */
export function effectivePermissions(
  claims: Pick<Claims, "roles" | "permissions"> | null | undefined,
): string[] {
  if (!claims) return [];
  const all = new Set(claims.permissions ?? []);
  for (const role of claims.roles ?? []) {
    if (isRole(role)) rolePermissions(role).forEach((p) => all.add(p));
  }
  return [...all];
}
