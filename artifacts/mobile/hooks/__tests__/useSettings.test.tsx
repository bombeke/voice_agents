import { fakeCaptures } from "@/mocks/captures";
import { fakeDeviceStatus } from "@/mocks/settings";
import {
  replaceCaptures,
  setCaptureStatus,
} from "@/services/storage/CaptureStore";
import {
  replaceDeviceStatus,
  resetSettings,
  settings$,
} from "@/services/storage/SettingsStore";
import { syncPendingCaptures } from "@/services/sync/CaptureSync";
import { act, renderHook } from "@testing-library/react-native";
import { useSettings } from "../useSettings";

jest.mock("@/services/storage/LegendState", () => ({
  isOnline$: require("@legendapp/state").observable(true),
}));
jest.mock("@/services/sync/CaptureSync", () => ({
  syncPendingCaptures: jest.fn(),
}));

beforeEach(() => {
  resetSettings();
  replaceDeviceStatus(fakeDeviceStatus());
  replaceCaptures(fakeCaptures(new Date(2026, 8, 23, 10, 14)));
});

describe("useSettings", () => {
  it("reads the settings, device status and pending queue", async () => {
    const { result } = await renderHook(() => useSettings());
    expect(result.current.settings.wifiOnlyPhotos).toBe(true);
    expect(result.current.status.model.version).toBe("det-v1.3.0");
    expect(result.current.storage.totalBytes).toBe(1_400_000_000);
    expect(result.current.pending).toBe(3);
    expect(result.current.syncing).toBe(false);
    expect(result.current.online).toBe(true);
  });

  it("writes a change through to the store", async () => {
    const { result } = await renderHook(() => useSettings());
    await act(() => result.current.set("units", "imperial"));
    expect(settings$.units.get()).toBe("imperial");
    expect(result.current.settings.units).toBe("imperial");
  });

  it("is syncing while a record uploads, and syncs through CaptureSync", async () => {
    const { result } = await renderHook(() => useSettings());
    const [first] = fakeCaptures(new Date(2026, 8, 23, 10, 14)).filter(
      (c) => c.syncStatus !== "synced",
    );
    await act(() => setCaptureStatus([first.id], "uploading"));
    expect(result.current.syncing).toBe(true);

    result.current.sync();
    expect(syncPendingCaptures).toHaveBeenCalled();
  });

  it("downloads the model update and clears synced photos", async () => {
    const { result } = await renderHook(() => useSettings());
    await act(() => {
      result.current.downloadModel();
    });
    expect(result.current.status.model).toEqual({ version: "v1.4.0" });

    await act(() => result.current.clearSyncedPhotos());
    expect(result.current.status.storage.syncedPhotosBytes).toBe(0);
  });
});
