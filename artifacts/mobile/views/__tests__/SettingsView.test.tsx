import { API_URL } from "@/constants/Config";
import { hostOf } from "@/helpers/settings";
import { fakeCaptures } from "@/mocks/captures";
import { fakeDeviceStatus } from "@/mocks/settings";
import { replaceCaptures } from "@/services/storage/CaptureStore";
import {
  deviceStatus$,
  replaceDeviceStatus,
  resetSettings,
  settings$,
} from "@/services/storage/SettingsStore";
import { syncPendingCaptures } from "@/services/sync/CaptureSync";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import { SettingsView } from "../SettingsView";

const mockLogout = jest.fn();
jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    claims: {
      sub: "field",
      exp: 0,
      name: "Field Enumerator",
      email: "field@iip.example.org",
      roles: ["enumerator"],
    },
    org: "UEDCL",
    authMethod: "sso",
    logout: mockLogout,
  }),
}));
jest.mock("@/services/storage/LegendState", () => ({
  isOnline$: require("@legendapp/state").observable(true),
}));
jest.mock("@/services/sync/CaptureSync", () => ({
  syncPendingCaptures: jest.fn(),
}));
jest.mock("expo-application", () => ({
  nativeApplicationVersion: "1.0.0",
  nativeBuildVersion: "100",
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));

type AlertButtons = Parameters<typeof Alert.alert>[2];
const pressAlertButton = (text: string) => {
  const calls = jest.mocked(Alert.alert).mock.calls;
  const buttons = calls[calls.length - 1][2] as AlertButtons;
  return buttons?.find((b) => b.text === text)?.onPress?.();
};

// Toggles animate their knob; run it to completion inside act.
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  resetSettings();
  replaceDeviceStatus(fakeDeviceStatus());
  // 3 of the fake captures are waiting to sync.
  replaceCaptures(fakeCaptures(new Date(2026, 8, 23, 10, 14)));
});
afterEach(async () => {
  await act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

describe("SettingsView", () => {
  it("shows the account and every group from the mockup", async () => {
    await render(<SettingsView />);
    expect(screen.getByRole("header", { name: "Settings" })).toBeOnTheScreen();
    expect(screen.getByText("Field Enumerator")).toBeOnTheScreen();
    expect(screen.getByText("Field enumerator · UEDCL")).toBeOnTheScreen();
    expect(screen.getByText("Casdoor SSO")).toBeOnTheScreen();
    for (const group of [
      "Capture",
      "Sync",
      "AI model",
      "Privacy & security",
      "General",
      "About",
      "Appearance",
      "Storage on this device",
    ]) {
      expect(screen.getByRole("header", { name: group })).toBeOnTheScreen();
    }
  });

  it("shows device facts: gate, model, versions and server", async () => {
    await render(<SettingsView />);
    expect(screen.getByText("< 4.0 m")).toBeOnTheScreen();
    expect(screen.getByText("det-v1.3.0")).toBeOnTheScreen();
    expect(screen.getByText("1.0.0 (100)")).toBeOnTheScreen();
    expect(screen.getByText(hostOf(API_URL))).toBeOnTheScreen();
    expect(screen.getByText("1.4 GB")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Offline map tiles: Zone 3" }),
    ).toBeDisabled();
  });

  it("saves a switch as soon as it is flipped", async () => {
    await render(<SettingsView />);
    const wifi = screen.getByRole("switch", {
      name: "Upload photos on Wi-Fi only",
    });
    expect(wifi).toBeChecked();
    await fireEvent.press(wifi);
    expect(settings$.wifiOnlyPhotos.get()).toBe(false);
    expect(wifi).not.toBeChecked();
  });

  it("picks from a list and shows the choice", async () => {
    await render(<SettingsView />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Photos per asset: Up to 3" }),
    );
    await fireEvent.press(screen.getByRole("radio", { name: "1 photo" }));
    expect(settings$.photosPerAsset.get()).toBe(1);
    expect(
      screen.getByRole("button", { name: "Photos per asset: 1 photo" }),
    ).toBeOnTheScreen();
  });

  it("chooses a theme", async () => {
    await render(<SettingsView />);
    await fireEvent.press(screen.getByRole("radio", { name: "Outdoor" }));
    expect(settings$.theme.get()).toBe("outdoor");
    expect(screen.getByRole("radio", { name: "Outdoor" })).toBeChecked();
  });

  it("syncs the waiting records and warns about them at sign-out", async () => {
    await render(<SettingsView />);
    expect(screen.getByText("3 records waiting")).toBeOnTheScreen();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /3 records haven’t synced/,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Sync now" }));
    expect(syncPendingCaptures).toHaveBeenCalled();
  });

  it("says so when everything is synced", async () => {
    replaceCaptures([]);
    await render(<SettingsView />);
    expect(screen.getByText("Everything is synced")).toBeOnTheScreen();
    expect(
      screen.queryByRole("button", { name: "Sync now" }),
    ).not.toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });

  it("downloads the model update", async () => {
    await render(<SettingsView />);
    await fireEvent.press(screen.getByRole("button", { name: "Download" }));
    expect(screen.getByText("v1.4.0")).toBeOnTheScreen();
    expect(screen.queryByText("Update available")).not.toBeOnTheScreen();
  });

  it("clears synced photos after confirming", async () => {
    await render(<SettingsView />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Clear photos already synced" }),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      "Clear synced photos?",
      "Frees 780 MB. The photos stay on the server and in each record.",
      expect.any(Array),
    );
    expect(deviceStatus$.storage.syncedPhotosBytes.get()).toBe(780_000_000);

    await act(() => pressAlertButton("Clear"));
    expect(deviceStatus$.storage.syncedPhotosBytes.get()).toBe(0);
    expect(
      screen.getByRole("button", { name: "Clear photos already synced" }),
    ).toBeDisabled();
  });

  it("signs out after confirming", async () => {
    await render(<SettingsView />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(mockLogout).not.toHaveBeenCalled();
    await act(() => pressAlertButton("Sign out"));
    expect(mockLogout).toHaveBeenCalled();
  });
});
