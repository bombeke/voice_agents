import { MAX_PHOTOS } from "@/constants/Capture";
import { captures$, clearCaptures } from "@/services/storage/CaptureStore";
import { setPhotoQualityChecker } from "@/services/capture/PhotoQuality";
import type {
  CapturedDetection,
  CapturedPhoto,
  GnssFix,
} from "@/types/Capture";
import { act, renderHook } from "@testing-library/react-native";
import { createAssetAsync } from "expo-media-library";
import { Alert } from "react-native";
import type { CameraPhotoOutput } from "react-native-vision-camera";
import {
  locationFrom,
  mergeDetections,
  useCaptureSession,
  type CaptureLocation,
} from "../useCaptureSession";

const mockAddPole = jest.fn();
jest.mock("@/providers/UtilityStoreProvider", () => ({
  useUtilityStorePoles: () => ({ addPole: mockAddPole }),
}));
jest.mock("@/hooks/Helpers", () => ({
  requestSavePermission: async () => true,
}));
jest.mock("expo-media-library", () => ({
  createAssetAsync: jest.fn(async () => ({})),
}));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++mockUuid}` }));

const photoOutput = (paths: string[]) =>
  ({
    capturePhoto: jest.fn(async () => ({
      saveToTemporaryFileAsync: async () => paths.shift() ?? "/tmp/extra.jpg",
    })),
  }) as unknown as CameraPhotoOutput;

const LOCATION: CaptureLocation = {
  latitude: 0.3476,
  longitude: 32.5825,
  accuracy: 2.8,
  flags: [],
};

const detection = (trackId: number, confidence: number): CapturedDetection => ({
  trackId,
  label: "pole",
  confidence,
  box: { xmin: 0.1, ymin: 0.1, xmax: 0.3, ymax: 0.9 },
});

const fix = (over: Partial<GnssFix> = {}): GnssFix => ({
  latitude: 1,
  longitude: 2,
  altitude: null,
  accuracy: 6,
  altitudeAccuracy: null,
  timestamp: 0,
  mocked: false,
  satellites: null,
  fixType: null,
  bands: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  clearCaptures();
  mockAddPole.mockResolvedValue(undefined);
  setPhotoQualityChecker(async () => ({ sharp: true, exposureOk: true }));
});

describe("locationFrom", () => {
  const averaged = {
    latitude: 5,
    longitude: 6,
    altitude: null,
    accuracy: 2.9,
    fixes: [],
  };

  it("stamps the averaged fix when the gate passed", () => {
    expect(locationFrom(averaged, fix(), false)).toEqual({
      latitude: 5,
      longitude: 6,
      accuracy: 2.9,
      flags: [],
    });
  });

  it("flags a draft with the raw latest fix as unverified", () => {
    expect(locationFrom(averaged, fix(), true)).toEqual({
      latitude: 1,
      longitude: 2,
      accuracy: 6,
      flags: ["gps_unverified"],
    });
  });

  it("flags mock-location fixes and needs some fix", () => {
    expect(locationFrom(averaged, fix({ mocked: true }), false)?.flags).toEqual(
      ["mock_location"],
    );
    expect(locationFrom(null, null, true)).toBeNull();
  });
});

describe("mergeDetections", () => {
  it("keeps the most confident sighting of each track across photos", () => {
    const p = (
      detections: CapturedDetection[],
      imageUri: string,
    ): CapturedPhoto => ({
      imageUri,
      capturedAt: 0,
      heading: null,
      detections,
      quality: { sharp: null, exposureOk: null },
    });
    const merged = mergeDetections([
      p([detection(1, 0.6), detection(2, 0.9)], "a"),
      p([detection(1, 0.8)], "b"),
    ]);
    expect(merged.map((m) => [m.detection.trackId, m.photo.imageUri])).toEqual([
      [1, "b"],
      [2, "a"],
    ]);
  });
});

describe("useCaptureSession", () => {
  it("takes up to three photos, keeps the first location and saves them to the gallery", async () => {
    const output = photoOutput(["/tmp/1.jpg", "/tmp/2.jpg", "/tmp/3.jpg"]);
    const { result } = await renderHook(() => useCaptureSession());
    for (let i = 0; i < MAX_PHOTOS + 1; i++) {
      await act(() =>
        result.current.takePhoto({
          photoOutput: output,
          flash: i === 0,
          location: { ...LOCATION, latitude: i },
          heading: 142,
          detections: [],
        }),
      );
    }
    expect(result.current.photos.map((p) => p.imageUri)).toEqual([
      "/tmp/1.jpg",
      "/tmp/2.jpg",
      "/tmp/3.jpg",
    ]);
    expect(result.current.isFull).toBe(true);
    expect(result.current.location?.latitude).toBe(0);
    expect(result.current.photos[0].quality).toEqual({
      sharp: true,
      exposureOk: true,
    });
    expect(output.capturePhoto).toHaveBeenCalledTimes(3);
    expect(output.capturePhoto).toHaveBeenNthCalledWith(
      1,
      { flashMode: "on" },
      {},
    );
    expect(createAssetAsync).toHaveBeenCalledWith("file:///tmp/1.jpg", "photo");
  });

  it("retakes a photo and forgets the location when none are left", async () => {
    const { result } = await renderHook(() => useCaptureSession());
    await act(() =>
      result.current.takePhoto({
        photoOutput: photoOutput(["/tmp/1.jpg"]),
        flash: false,
        location: LOCATION,
        heading: null,
        detections: [],
      }),
    );
    await act(() => result.current.removePhoto(0));
    expect(result.current.photos).toEqual([]);
    expect(result.current.location).toBeNull();
  });

  it("saves one record per merged detection plus a Home summary", async () => {
    const { result } = await renderHook(() => useCaptureSession());
    await act(() =>
      result.current.takePhoto({
        photoOutput: photoOutput(["/tmp/1.jpg"]),
        flash: false,
        location: LOCATION,
        heading: 142,
        detections: [detection(1, 0.9), detection(2, 0.5)],
      }),
    );
    let saved = false;
    await act(async () => {
      saved = await result.current.save({
        category: "energy",
        tag: "damaged",
        comment: "leaning",
      });
    });

    expect(saved).toBe(true);
    const records = mockAddPole.mock.calls[0][0];
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      latitude: 0.3476,
      longitude: 32.5825,
      accuracy: 2.8,
      heading: 142,
      category: "energy",
      tag: "damaged",
      comment: "leaning",
      label: "pole",
      trackId: 1,
      detectionConfidence: 0.9,
      imageUri: "/tmp/1.jpg",
      modelVersion: "yolo26n_384_xnnpack_fp32.pte",
      synced: false,
    });
    expect(captures$.get()).toEqual([
      expect.objectContaining({
        category: "energy",
        syncStatus: "pending",
        accuracyM: 2.8,
        flagged: false,
      }),
    ]);
    expect(result.current.photos).toEqual([]);
  });

  it("saves a single record when nothing was detected", async () => {
    const { result } = await renderHook(() => useCaptureSession());
    await act(() =>
      result.current.takePhoto({
        photoOutput: photoOutput(["/tmp/1.jpg"]),
        flash: false,
        location: { ...LOCATION, flags: ["gps_unverified"] },
        heading: null,
        detections: [],
      }),
    );
    await act(async () => {
      await result.current.save({
        category: "water",
        tag: "good",
        comment: "",
      });
    });
    expect(mockAddPole.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        imageUri: "/tmp/1.jpg",
        flags: ["gps_unverified"],
      }),
    ]);
    expect(captures$.get()[0]).toMatchObject({
      title: "Water & Sanitation",
      flagged: true,
    });
  });

  it("keeps the photos and alerts when saving fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockAddPole.mockRejectedValueOnce(new Error("disk full"));
    const { result } = await renderHook(() => useCaptureSession());
    await act(() =>
      result.current.takePhoto({
        photoOutput: photoOutput(["/tmp/1.jpg"]),
        flash: false,
        location: LOCATION,
        heading: null,
        detections: [],
      }),
    );
    let saved = true;
    await act(async () => {
      saved = await result.current.save({
        category: "roads",
        tag: "poor",
        comment: "",
      });
    });
    expect(saved).toBe(false);
    expect(alert).toHaveBeenCalled();
    expect(result.current.photos).toHaveLength(1);
  });
});
