import { observable } from "@legendapp/state";
import { configureSynced, syncObservable } from "@legendapp/state/sync";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import type { AuthType } from "../Api";
import { MAP_PREFS_STORAGE_KEY, mapPreferences$ } from "./AssetStore";
import { DEVICE_STATUS_STORAGE_KEY, deviceStatus$ } from "./SettingsStore";

/*
 * Ephemeral, device-wide UI and session state, persisted to MMKV through
 * Legend's persist plugin: the auth session, this device's id, the device
 * status and the map's preferences. Records never live here: they are in the
 * user's SQLite database (db/). The user's own preferences are in UserData.ts.
 */

let configured = false;

//@ts-ignore
export const authStore$ = observable<AuthType>({ kind: "basic" });

const deviceId$ = observable<string>("");

/** Re-exported for existing imports; see NetworkState.ts. */
export { isOnline$ } from "./NetworkState";

/**
 * Stable per-install id used as this device's slot in vector clocks.
 * Must only be generated after persistence has loaded, otherwise every launch
 * gets a new id and the clocks grow without bound.
 */
export const getDeviceId = (): string => {
  let id = deviceId$.peek();
  if (!id) {
    id = randomUUID();
    deviceId$.set(id);
  }
  return id;
};

export function initPersistence() {
  if (configured) return;
  if (Platform.OS === "web") {
    configured = true;
    return;
  }

  const {
    ObservablePersistMMKV,
  } = require("@legendapp/state/persist-plugins/mmkv");
  const syncPlugin = configureSynced({
    persist: {
      plugin: ObservablePersistMMKV,
    },
  });

  syncObservable(
    authStore$,
    syncPlugin({ persist: { name: "polevision_auth_store" } }),
  );
  syncObservable(
    deviceStatus$,
    syncPlugin({ persist: { name: DEVICE_STATUS_STORAGE_KEY } }),
  );
  syncObservable(
    mapPreferences$,
    syncPlugin({ persist: { name: MAP_PREFS_STORAGE_KEY } }),
  );
  syncObservable(
    deviceId$,
    syncPlugin({
      persist: {
        name: "polevision_device_meta",
        mmkv: { id: "polevision_device_meta_db" },
      },
    }),
  );

  configured = true;

  // MMKV loads synchronously, so the persisted id is available from here on.
  getDeviceId();
}
