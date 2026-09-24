import { getSecret, saveSecret } from "@/services/AuthHelpers";
import type { Enumerator } from "@/types/Capture";
import { batch, observable, type Observable } from "@legendapp/state";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import { createMMKV, type MMKV } from "react-native-mmkv";
import { queryClient } from "../Api";
import { CAPTURES_STORAGE_KEY, captures$ } from "./CaptureStore";
import {
  STORAGE_EVENTS_KEY,
  STORAGE_OPS_KEY,
  auditLog$,
  eventsStore$,
  failedOps$,
  opQueue$,
  poleVisionDB$,
  poleVisionDBTracks$,
  repairLegacyState,
  settleUploads,
} from "./LegendState";
import { RECORDS_STORAGE_KEY, records$ } from "./RecordStore";
import {
  REVIEW_DECISIONS_STORAGE_KEY,
  REVIEW_QUEUE_STORAGE_KEY,
  reviewDecisions$,
  reviewQueue$,
} from "./ReviewStore";
import { SETTINGS_STORAGE_KEY, settings$ } from "./SettingsStore";

/**
 * A store that belongs to the signed-in user. `legacy` is where builds before
 * per-user data kept it (Legend's MMKV plugin: one JSON value per key, in the
 * `obsPersist` instance unless another id was configured).
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

/**
 * Everything a user captured, queued or decided, plus their preferences.
 * Device-wide state (session, device id, model and storage status, the map's
 * asset cache and basemap) stays in `initPersistence()`.
 */
const USER_STORES: UserStore[] = [
  store(CAPTURES_STORAGE_KEY, captures$),
  store(RECORDS_STORAGE_KEY, records$),
  store(REVIEW_QUEUE_STORAGE_KEY, reviewQueue$),
  store(REVIEW_DECISIONS_STORAGE_KEY, reviewDecisions$),
  store(SETTINGS_STORAGE_KEY, settings$),
  store(STORAGE_OPS_KEY, opQueue$),
  store("polevision_failed_ops_v1", failedOps$),
  store(STORAGE_EVENTS_KEY, eventsStore$),
  store("polevision_audit_log_v1", auditLog$),
  store("polevision_app_db_v1", poleVisionDB$, {
    id: "polevision_poles_db",
    key: "polevision_app_db_v1",
  }),
  store("polevision_tracks", poleVisionDBTracks$, {
    id: "polevision_tracks_db",
    key: "polevision_tracks",
  }),
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

/**
 * Moves data an older build kept device-wide into this user's space, once:
 * the old keys are removed, so the next user starts empty. On a personal
 * phone the first user to sign in after the update is its owner.
 */
function claimLegacyData(storage: MMKV) {
  const instances = new Map<string, MMKV>();
  const legacyStorage = (id: string) => {
    let s = instances.get(id);
    if (!s) {
      s = createMMKV({ id });
      instances.set(id, s);
    }
    return s;
  };
  for (const { key, legacy } of USER_STORES) {
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
let hooks: ((user: Enumerator) => void)[] = [];

/** Whose data is open: stamped on every capture as `capturedBy`. */
export const currentUser$ = observable<Enumerator | null>(null);

/** Runs after a user's data is loaded, e.g. the dev mocks' seed. */
export function onUserDataOpened(hook: (user: Enumerator) => void) {
  hooks.push(hook);
  return () => {
    hooks = hooks.filter((h) => h !== hook);
  };
}

/**
 * Loads the user's stores and keeps them saved to their own encrypted
 * database. Another user's data is closed first. Web has no MMKV: the stores
 * only live in memory there.
 */
export async function openUserData(user: Enumerator): Promise<void> {
  if (current?.user.id === user.id) {
    currentUser$.set(user);
    return;
  }
  await closeUserData();
  const userId = user.id;

  const storage =
    Platform.OS === "web"
      ? null
      : createMMKV({
          id: userStorageId(userId),
          encryptionKey: await encryptionKey(userId),
        });
  if (storage) claimLegacyData(storage);

  batch(() => {
    for (const { key, obs$ } of USER_STORES) {
      const saved = parse(storage?.getString(key));
      obs$.set(saved ?? parse(EMPTY.get(key)));
    }
  });

  const unsubscribe = storage
    ? USER_STORES.map(({ key, obs$ }) =>
        obs$.onChange(({ value }) => {
          storage.set(key, JSON.stringify(value ?? null));
        }),
      )
    : [];
  current = { user, storage, unsubscribe };
  currentUser$.set(user);

  repairLegacyState();
  hooks.forEach((hook) => hook(user));
}

/**
 * Waits for an upload in flight, stops saving and empties the stores. The
 * user's unsent records stay in their database until they sign in again.
 */
export async function closeUserData(): Promise<void> {
  if (!current) return;
  await settleUploads();
  current.unsubscribe.forEach((off) => off());
  current = null;
  currentUser$.set(null);
  batch(() => {
    for (const { key, obs$ } of USER_STORES) obs$.set(parse(EMPTY.get(key)));
  });
  // Server data fetched for this user must not show for the next one.
  queryClient.clear();
}
