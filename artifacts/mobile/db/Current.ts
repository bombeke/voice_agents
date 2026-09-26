import { getSecret, saveSecret } from "@/services/AuthHelpers";
import { observable } from "@legendapp/state";
import { getRandomBytes } from "expo-crypto";
import { Platform } from "react-native";
import type { Database } from "./Database";
import { migrate } from "./Migrate";
import { timed } from "./Timing";

/**
 * The signed-in user's database. `openUserDatabase` runs at sign-in (see
 * UserData.ts), `closeUserDatabase` at sign-out; there is at most one open.
 */
let current: { userId: string; db: Database } | null = null;

/** Bumps whenever the open database changes, so live queries re-subscribe. */
export const dbEpoch$ = observable(0);

export class NoDatabaseError extends Error {
  constructor() {
    super("No user database is open");
  }
}

export function getDb(): Database {
  if (!current) throw new NoDatabaseError();
  return current.db;
}

export const peekDb = (): Database | null => current?.db ?? null;

/** File names allow letters, digits, "-" and "_"; subs can be emails. */
export const userDbName = (userId: string) =>
  `iip-user-${userId.replace(/[^A-Za-z0-9_-]/g, "_")}.db`;

const keyName = (userId: string) => `iip_db_key_${userId}`;

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** A random 256-bit key per user, kept in the platform keystore. */
async function databaseKey(userId: string): Promise<string | undefined> {
  if (Platform.OS === "web") return undefined;
  const name = keyName(userId);
  const existing = await getSecret(name);
  if (existing) return existing;
  const key = toHex(getRandomBytes(32));
  await saveSecret(name, key);
  return key;
}

export type DatabaseFactory = (userId: string) => Promise<Database>;

/** op-sqlite with the user's SQLCipher key. */
const openOnDevice: DatabaseFactory = async (userId) => {
  // Required lazily: the native module must not load in Jest.
  const { openDatabase, rawKey } =
    require("./Client") as typeof import("./Client");
  const hex = await databaseKey(userId);
  return openDatabase({
    name: userDbName(userId),
    encryptionKey: hex ? rawKey(hex) : undefined,
  });
};

let factory: DatabaseFactory = openOnDevice;

/** Tests: open users' databases with e.g. openNodeDatabase instead. */
export function setDatabaseFactory(next: DatabaseFactory | null) {
  factory = next ?? openOnDevice;
}

/** Opens (creating and migrating if need be) the user's encrypted database. */
export async function openUserDatabase(userId: string): Promise<Database> {
  if (current?.userId === userId) return current.db;
  await closeUserDatabase();
  const db = await timed("open", async () => {
    const opened = await factory(userId);
    await migrate(opened);
    return opened;
  });
  current = { userId, db };
  dbEpoch$.set((n) => n + 1);
  return db;
}

export async function closeUserDatabase(): Promise<void> {
  if (!current) return;
  const { db } = current;
  current = null;
  dbEpoch$.set((n) => n + 1);
  await db.close();
}

/** Tests: installs a database (e.g. from openNodeDatabase) as the open one. */
export function setDatabase(db: Database | null, userId = "test-user") {
  current = db ? { userId, db } : null;
  dbEpoch$.set((n) => n + 1);
}
