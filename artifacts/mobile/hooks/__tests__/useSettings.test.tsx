import { seedCaptures, setupTestDatabase } from "@/db/testing/TestDb";
import { fakeCaptures } from "@/mocks/captures";
import { fakeDeviceStatus } from "@/mocks/settings";
import {
  replaceDeviceStatus,
  resetSettings,
  settings$,
} from "@/services/storage/SettingsStore";
import { syncPendingCaptures } from "@/services/sync/CaptureSync";
import { syncActivity$ } from "@/services/sync/SyncRuntime";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useSettings } from "../useSettings";

jest.mock("@/services/sync/CaptureSync", () => ({
  syncPendingCaptures: jest.fn(),
}));
jest.mock("@/services/sync/SyncRuntime", () => ({
  syncActivity$: require("@legendapp/state").observable({
    outbox: false,
    photos: false,
  }),
}));

const getDb = setupTestDatabase();

beforeEach(async () => {
  resetSettings();
  replaceDeviceStatus(fakeDeviceStatus());
  syncActivity$.set({ outbox: false, photos: false });
  await seedCaptures(getDb(), fakeCaptures(new Date(2026, 8, 23, 10, 14)));
});

async function render() {
  const hook = await renderHook(() => useSettings());
  await waitFor(() => expect(hook.result.current.pending).toBe(3));
  return hook;
}

describe("useSettings", () => {
  it("reads the settings, device status and pending queue", async () => {
    const { result } = await render();
    expect(result.current.settings.wifiOnlyPhotos).toBe(true);
    expect(result.current.status.model.version).toBe("det-v1.3.0");
    expect(result.current.storage.totalBytes).toBe(1_400_000_000);
    expect(result.current.syncing).toBe(false);
    expect(result.current.online).toBe(true);
  });

  it("writes a change through to the store", async () => {
    const { result } = await render();
    await act(() => result.current.set("units", "imperial"));
    expect(settings$.units.get()).toBe("imperial");
    expect(result.current.settings.units).toBe("imperial");
  });

  it("is syncing while an upload runs with records pending, and syncs through CaptureSync", async () => {
    const { result } = await render();
    await act(() => syncActivity$.outbox.set(true));
    expect(result.current.syncing).toBe(true);
    result.current.sync();
    expect(syncPendingCaptures).toHaveBeenCalled();
  });

  it("downloads the model update and clears synced photos", async () => {
    const { result } = await render();
    await act(() => {
      result.current.downloadModel();
    });
    expect(result.current.status.model).toEqual({ version: "v1.4.0" });
    await act(() => result.current.clearSyncedPhotos());
    expect(result.current.status.storage.syncedPhotosBytes).toBe(0);
  });
});
