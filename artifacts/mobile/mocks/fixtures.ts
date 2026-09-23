/**
 * Test identities for the fake server. There are no passwords: any non-empty
 * password signs a listed user in, and "wrong" is rejected to show the error
 * state. These accounts exist nowhere but this file.
 */
export interface FakeUser {
  username: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export const REJECTED_PASSWORD = "wrong";
export const FAKE_ORG = "Pilot Zone 3";

export const FAKE_USERS: FakeUser[] = [
  {
    username: "field",
    email: "field@iip.example.org",
    name: "Field Enumerator",
    roles: ["enumerator"],
    permissions: ["agents:view"],
  },
  {
    username: "supervisor",
    email: "supervisor@iip.example.org",
    name: "Area Supervisor",
    roles: ["supervisor"],
    permissions: ["agents:view", "records:review"],
  },
  {
    username: "admin",
    email: "admin@iip.example.org",
    name: "Platform Admin",
    roles: ["admin"],
    permissions: [
      "agents:view",
      "records:review",
      "admin:read",
      "admin:users:read",
      "admin:policies:read",
    ],
  },
];

/** The user "Continue with SSO" signs in as. */
export const FAKE_SSO_USER = FAKE_USERS[0];
