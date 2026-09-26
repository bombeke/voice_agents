import { closeUserDatabase, openUserDatabase } from "@/db/Current";
import { endMark, mark } from "@/db/Timing";
import { getSecret, saveSecret } from "@/services/AuthHelpers";
import { startSync, stopSync } from "@/services/sync/SyncRuntime";
import type { Enumerator } from "@/types/Capture";
import { observable, type Observable } from "@legendapp/state";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import { createMMKV, type MMKV } from "react-native-mmkv";
import { queryClient } from "../Api";
import { importLegacyData, LEGACY_KEYS } from "./LegacyImport";
import { getDeviceId } from "./LegendState";
import { SETTINGS_STORAGE_KEY, settings$ } from "./SettingsStore";

/**
 * A preference store that belongs to the signed-in user, persisted to their
 * own encrypted MMKV. `legacy` is where builds before per-user data kept it.
 * Records are not here: they live in the user's SQLite database (db/).
 */
interface UserStore {
  key: string;
  obs$: Observable<any>;
  legacy?: { id: string; key: string };
}

const LEGACY_DEFAULT_ID = "obsPersist";

const store = (
  key: string,
  obs$: Observable<any>,
  legacy: UserStore["legacy"] = { id: LEGACY_DEFAULT_ID, key },
): UserStore => ({ key, obs$, legacy });

/** The user's preferences: small, hot, and fine to lose to a reinstall. */
const USER_STORES: UserStore[] = [store(SETTINGS_STORAGE_KEY, settings$)];

/**
 * Record blobs builds before per-user data kept device-wide. Claimed into the
 * signing-in user's MMKV first, then moved into SQLite by LegacyImport.
 */
const LEGACY_RECORD_STORES: {
  key: string;
  legacy: { id: string; key: string };
}[] = [
  ...[
    LEGACY_KEYS.captures,
    LEGACY_KEYS.records,
    LEGACY_KEYS.reviewQueue,
    LEGACY_KEYS.reviewDecisions,
    LEGACY_KEYS.opQueue,
    LEGACY_KEYS.failedOps,
    LEGACY_KEYS.events,
    LEGACY_KEYS.auditLog,
  ].map((key) => ({ key, legacy: { id: LEGACY_DEFAULT_ID, key } })),
  {
    key: LEGACY_KEYS.poles,
    legacy: { id: "polevision_poles_db", key: LEGACY_KEYS.poles },
  },
  {
    key: LEGACY_KEYS.tracks,
    legacy: { id: "polevision_tracks_db", key: LEGACY_KEYS.tracks },
  },
];

/** Each store's value before anyone signs in: what sign-out returns it to. */
const EMPTY = new Map(
  USER_STORES.map((s) => [s.key, JSON.stringify(s.obs$.peek())]),
);

const encryptionKeyName = (userId: string) => `iip_user_key_${userId}`;

/** A random key per user, kept in the platform keystore. */
async function encryptionKey(userId: string): Promise<string | undefined> {
  if (Platform.OS === "web") return undefined;
  const name = encryptionKeyName(userId);
  const existing = await getSecret(name);
  if (existing) return existing;
  // MMKV takes at most 16 bytes of key.
  const key = randomUUID().replace(/-/g, "").slice(0, 16);
  await saveSecret(name, key);
  return key;
}

/** MMKV ids allow letters, digits, "-" and "_"; subs can be emails. */
export const userStorageId = (userId: string) =>
  `iip-user-${userId.replace(/[^A-Za-z0-9_-]/g, "_")}`;

const parse = (raw: string | undefined): unknown => {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const instances = new Map<string, MMKV>();
const legacyStorage = (id: string) => {
  let s = instances.get(id);
  if (!s) {
    s = createMMKV({ id });
    instances.set(id, s);
  }
  return s;
};

/**
 * Moves data an older build kept device-wide into this user's space, once:
 * the old keys are removed, so the next user starts empty. On a personal
 * phone the first user to sign in after the update is its owner.
 */
function claimLegacyData(storage: MMKV) {
  for (const { key, legacy } of [...USER_STORES, ...LEGACY_RECORD_STORES]) {
    if (!legacy) continue;
    const old = legacyStorage(legacy.id);
    const raw = old.getString(legacy.key);
    if (raw === undefined) continue;
    if (!storage.contains(key) && parse(raw) !== undefined) {
      storage.set(key, raw);
    }
    old.remove(legacy.key);
    old.remove(`${legacy.key}__m`);
  }
}

interface OpenUser {
  user: Enumerator;
  storage: MMKV | null;
  unsubscribe: (() => void)[];
}

let current: OpenUser | null = null;
let hooks: ((user: Enumerator) => void | Promise<void>)[] = [];

/** Whose data is open: stamped on every capture as `capturedBy`. */
export const currentUser$ = observable<Enumerator | null>(null);

/** Runs after a user's data is loaded, e.g. the dev mocks' seed. */
export function onUserDataOpened(
  hook: (user: Enumerator) => void | Promise<void>,
) {
  hooks.push(hook);
  return () => {
    hooks = hooks.filter((h) => h !== hook);
  };
}

/**
 * Opens the user's data: their preferences from their encrypted MMKV, and
 * their records from their encrypted SQLite database (created and migrated
 * if need be). Data from builds before SQLite is imported once. Another
 * user's data is closed first.
 */
export async function openUserData(user: Enumerator): Promise<void> {
  if (current?.user.id === user.id) {
    currentUser$.set(user);
    return;
  }
  await closeUserData();
  mark("open-user-data");
  const userId = user.id;

  const storage =
    Platform.OS === "web"
      ? null
      : createMMKV({
          id: userStorageId(userId),
          encryptionKey: await encryptionKey(userId),
        });
  if (storage) claimLegacyData(storage);

  for (const { key, obs$ } of USER_STORES) {
    const saved = parse(storage?.getString(key));
    obs$.set(saved ?? parse(EMPTY.get(key)));
  }
  const unsubscribe = storage
    ? USER_STORES.map(({ key, obs$ }) =>
        obs$.onChange(({ value }) => {
          storage.set(key, JSON.stringify(value ?? null));
        }),
      )
    : [];

  const db = await openUserDatabase(userId);
  if (storage) {
    try {
      const { imported, counts } = await importLegacyData(
        db,
        storage,
        legacyStorage(LEGACY_DEFAULT_ID),
        { deviceId: getDeviceId() },
      );
      if (imported && Object.values(counts).some((n) => n > 0)) {
        console.log("[storage] imported legacy data", counts);
      }
    } catch (err) {
      // The blobs stay in MMKV; the import runs again at the next sign-in.
      console.error("[storage] legacy import failed", err);
    }
  }
  current = { user, storage, unsubscribe };
  currentUser$.set(user);
  endMark("open-user-data");

  for (const hook of hooks) await hook(user);
  startSync(db);
}

/**
 * Waits for an upload in flight, stops the workers, and closes the user's
 * database and preferences. Unsent records stay in their database until they
 * sign in again.
 */
export async function closeUserData(): Promise<void> {
  if (!current) return;
  await stopSync();
  current.unsubscribe.forEach((off) => off());
  current = null;
  currentUser$.set(null);
  for (const { key, obs$ } of USER_STORES) obs$.set(parse(EMPTY.get(key)));
  await closeUserDatabase();
  // Server data fetched for this user must not show for the next one.
  queryClient.clear();
}
