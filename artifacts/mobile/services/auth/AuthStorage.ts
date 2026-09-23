import { APP_SECURE_AUTH_STATE_KEY } from "@/constants/Config";
import type { Session } from "@/types/Auth";
import { deleteItemAsync } from "expo-secure-store";
import { Platform } from "react-native";
import { createMMKV } from "react-native-mmkv";
import { getSecret, saveSecret } from "../AuthHelpers";

/**
 * Dedicated store: the shared `createUserStorage` singleton ignores its id, so
 * auth keys (and any clear) would otherwise hit the whole app's MMKV.
 */
export const authStorage = createMMKV({
  id: "auth-session",
  encryptionKey: "auth-session-v1",
});

const META_KEY = "session";
// SecureStore has no web implementation; fall back to MMKV there.
const secureTokens = Platform.OS !== "web";

type StoredMeta = Omit<Session, "token" | "persist">;

// "Keep me signed in" off: the session lives here only and dies with the app.
let memorySession: Session | null = null;

export async function saveSession(session: Session) {
  memorySession = session;
  if (!session.persist) {
    await removePersisted();
    return;
  }
  const { token, persist: _persist, ...meta } = session;
  authStorage.set(META_KEY, JSON.stringify(meta satisfies StoredMeta));
  if (secureTokens) {
    await saveSecret(APP_SECURE_AUTH_STATE_KEY, token);
  } else {
    authStorage.set(APP_SECURE_AUTH_STATE_KEY, token);
  }
}

export async function loadSession(): Promise<Session | null> {
  if (memorySession) return memorySession;

  const raw = authStorage.getString(META_KEY);
  if (!raw) return null;
  const token = secureTokens
    ? await getSecret(APP_SECURE_AUTH_STATE_KEY)
    : (authStorage.getString(APP_SECURE_AUTH_STATE_KEY) ?? null);
  if (!token) return null;

  try {
    const meta = JSON.parse(raw) as StoredMeta;
    memorySession = { ...meta, token, persist: true };
    return memorySession;
  } catch {
    await clearSession();
    return null;
  }
}

/** Hot path for the axios interceptor. */
export async function getToken() {
  return (await loadSession())?.token ?? null;
}

export async function clearSession() {
  memorySession = null;
  await removePersisted();
}

async function removePersisted() {
  authStorage.remove(META_KEY);
  authStorage.remove(APP_SECURE_AUTH_STATE_KEY);
  if (secureTokens) await deleteItemAsync(APP_SECURE_AUTH_STATE_KEY);
}
