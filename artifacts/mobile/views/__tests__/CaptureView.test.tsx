import { DRAFT_OFFER_AFTER_MS } from "@/constants/Capture";
import {
  expoLocationSource,
  setGnssSource,
  type GnssListener,
} from "@/services/location/GnssSource";
import { captureSession$ } from "@/services/storage/CaptureSessionStore";
import type { GnssFix } from "@/types/Capture";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { CaptureView } from "../CaptureView";

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  canGoBack: () => true,
};
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));

jest.mock("@/providers/UtilityStoreProvider", () => ({
  useUtilityStorePoles: () => ({ addPole: jest.fn() }),
}));
jest.mock("@/hooks/Helpers", () => ({
  requestSavePermission: async () => true,
}));
jest.mock("expo-media-library", () => ({
  createAssetAsync: jest.fn(async () => ({})),
}));

const mockCamera = {
  hasPermission: true,
  requestPermission: jest.fn(),
  device: { id: "back", position: "back" } as unknown,
};
const mockPhotoOutput = {
  capturePhoto: jest.fn(async () => ({
    saveToTemporaryFileAsync: async () => "/tmp/1.jpg",
  })),
};
jest.mock("react-native-vision-camera", () => {
  const { View } = jest.requireActual("react-native");
  return {
    Camera: (props: object) => <View testID="camera-preview" {...props} />,
    useCameraPermission: () => ({
      hasPermission: mockCamera.hasPermission,
      requestPermission: mockCamera.requestPermission,
    }),
    useCameraDevice: () => mockCamera.device,
    usePhotoOutput: () => mockPhotoOutput,
  };
});

const mockDetection = {
  status: "ready" as "ready" | "loading" | "unavailable",
  downloadProgress: 100,
  snapshot: [] as unknown[],
};
jest.mock("@/hooks/useLiveDetection", () => ({
  useLiveDetection: () => ({
    frameOutput: {},
    tracks: { value: [] },
    trackLabels: [],
    frameSize: null,
    status: mockDetection.status,
    downloadProgress: mockDetection.downloadProgress,
    snapshot: () => mockDetection.snapshot,
  }),
}));

const fix = (accuracy: number): GnssFix => ({
  latitude: 0.3476,
  longitude: 32.5825,
  altitude: null,
  accuracy,
  altitudeAccuracy: null,
  timestamp: Date.now(),
  mocked: false,
  satellites: 18,
  fixType: "3D",
  bands: "L1+L5",
});

let listener: GnssListener | undefined;
beforeEach(() => {
  jest.clearAllMocks();
  listener = undefined;
  mockCamera.hasPermission = true;
  mockCamera.device = { id: "back", position: "back" };
  mockDetection.status = "ready";
  mockDetection.snapshot = [];
  setGnssSource({
    start: async (l) => {
      listener = l;
      return () => {};
    },
  });
});
afterEach(() => setGnssSource(expoLocationSource));

async function lockGps() {
  await waitFor(() => expect(listener).toBeDefined());
  for (const a of [3.4, 3.1, 2.8]) await act(() => listener!.onFix(fix(a)));
}

describe("CaptureView", () => {
  it("asks for permissions before showing the camera", async () => {
    mockCamera.hasPermission = false;
    await render(<CaptureView category="energy" />);
    await fireEvent.press(screen.getByRole("button", { name: "Allow access" }));
    expect(mockCamera.requestPermission).toHaveBeenCalled();
    expect(screen.queryByTestId("camera-preview")).toBeNull();
  });

  it("explains a missing back camera", async () => {
    mockCamera.device = undefined;
    await render(<CaptureView category="energy" />);
    expect(
      screen.getByText("No back camera was found on this device."),
    ).toBeTruthy();
  });

  it("keeps the shutter locked until GPS is locked", async () => {
    await render(<CaptureView category="energy" />);
    expect(screen.getByText("Energy & Power")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Take photo — locked until GPS accuracy is under 4 metres",
      }),
    ).toBeDisabled();

    await lockGps();
    expect(screen.getByText("Location locked")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Take photo" })).toBeEnabled();
  });

  it("captures, then continues to the detection review", async () => {
    mockDetection.snapshot = [
      {
        trackId: 1,
        label: "pole",
        confidence: 0.91,
        box: { xmin: 0.3, ymin: 0, xmax: 0.6, ymax: 1 },
      },
    ];
    await render(<CaptureView category="energy" />);
    await lockGps();

    await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy(),
    );
    expect(mockPhotoOutput.capturePhoto).toHaveBeenCalledWith(
      { flashMode: "off" },
      {},
    );

    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/capture/review");
    expect(captureSession$.detections.peek()).toEqual([
      expect.objectContaining({
        trackId: 1,
        decision: "accepted",
        imageUri: "/tmp/1.jpg",
      }),
    ]);
  });

  it("starts an empty session and discards it on close", async () => {
    await render(<CaptureView category="water" />);
    expect(captureSession$.category.peek()).toBe("water");
    await lockGps();
    await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    await waitFor(() => expect(captureSession$.photos.peek()).toHaveLength(1));
    await fireEvent.press(screen.getByRole("button", { name: "Close camera" }));
    expect(captureSession$.photos.peek()).toEqual([]);
  });

  it("closes from the top bar", async () => {
    await render(<CaptureView category="water" />);
    await fireEvent.press(screen.getByRole("button", { name: "Close camera" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("tells the surveyor when AI detection is unavailable", async () => {
    mockDetection.status = "unavailable";
    await render(<CaptureView category="roads" />);
    expect(
      screen.getByText(
        "AI detection unavailable. You can still capture; the record is checked after sync.",
      ),
    ).toBeTruthy();
  });

  it("offers a flagged draft after two minutes without a lock", async () => {
    jest.useFakeTimers();
    try {
      await render(<CaptureView category="telecom" />);
      await act(async () => {
        jest.advanceTimersByTime(DRAFT_OFFER_AFTER_MS + 1);
      });
      await fireEvent.press(
        screen.getByRole("button", {
          name: "Can’t get below 4 m? Save as draft for review",
        }),
      );
      expect(screen.getByRole("button", { name: "Take photo" })).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });
});
