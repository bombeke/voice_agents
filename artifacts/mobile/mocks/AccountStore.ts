import { createMMKV } from "react-native-mmkv";
import { FAKE_USERS, type FakeUser } from "./fixtures";

/**
 * Accounts the fake server knows: the fixture users plus anyone who signed up
 * through the Register screen. Sign-ups persist in their own MMKV store so
 * they survive a reload. No passwords are kept: the fake server accepts any.
 */
export interface FakeAccount extends FakeUser {
  status: "active" | "pending_verification";
  phone?: string;
}

const storage = createMMKV({ id: "dev-mock-accounts" });
const KEY = "registered";

function registered(): FakeAccount[] {
  try {
    return JSON.parse(storage.getString(KEY) ?? "[]");
  } catch {
    return [];
  }
}

const normalise = (identifier: unknown) =>
  String(identifier ?? "")
    .trim()
    .toLowerCase();

export const accountStore = {
  find(identifier: unknown): FakeAccount | undefined {
    const id = normalise(identifier);
    if (!id) return undefined;
    const fixture = FAKE_USERS.find((u) => u.username === id || u.email === id);
    if (fixture) return { ...fixture, status: "active" };
    return registered().find((a) => a.username === id || a.email === id);
  },

  /** New sign-ups wait for email verification and an admin-assigned role. */
  add(input: { name: string; email: string; phone?: string }): FakeAccount {
    const email = normalise(input.email);
    const account: FakeAccount = {
      username: email,
      email,
      name: input.name.trim(),
      ...(input.phone && { phone: input.phone }),
      roles: [],
      permissions: [],
      status: "pending_verification",
    };
    storage.set(KEY, JSON.stringify([...registered(), account]));
    return account;
  },

  clear() {
    storage.remove(KEY);
  },
};
