import { MAX_PHOTOS } from "@/constants/Capture";
import { captures$, clearCaptures } from "@/services/storage/CaptureStore";
import { setPhotoQualityChecker } from "@/services/capture/PhotoQuality";
import {
  acceptDetection,
  beginReview,
  rejectDetection,
  setAttribute,
  setComment,
  setDuplicateChoice,
  setFunctional,
  setTagCategory,
  startSession,
  toggleStatus,
} from "@/services/storage/CaptureSessionStore";
import type { LocalPole } from "@/services/storage/LegendState";
import type { CaptureLocation, CapturedDetection } from "@/types/Capture";
import { act, renderHook } from "@testing-library/react-native";
import { createAssetAsync } from "expo-media-library";
import { Alert } from "react-native";
import type { CameraPhotoOutput } from "react-native-vision-camera";
import { useCaptureSession } from "../useCaptureSession";

const mockAddPole = jest.fn();
let mockPoles: LocalPole[] = [];
jest.mock("@/providers/UtilityStoreProvider", () => ({
  useUtilityStorePoles: () => ({ addPole: mockAddPole, poles: mockPoles }),
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
  altitude: 1190,
  satellites: 18,
  flags: [],
};

const detection = (trackId: number, confidence: number): CapturedDetection => ({
  trackId,
  label: "pole",
  confidence,
  box: { xmin: 0.1, ymin: 0.1, xmax: 0.3, ymax: 0.9 },
});

beforeEach(() => {
  jest.clearAllMocks();
  clearCaptures();
  startSession("energy");
  mockPoles = [];
  mockAddPole.mockResolvedValue(undefined);
  setPhotoQualityChecker(async () => ({ sharp: true, exposureOk: true }));
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

  it("ignores a second tap while a photo is being taken", async () => {
    const output = photoOutput(["/tmp/1.jpg", "/tmp/2.jpg"]);
    const { result } = await renderHook(() => useCaptureSession());
    const args = {
      photoOutput: output,
      flash: false,
      location: LOCATION,
      heading: null,
      detections: [],
    };
    await act(() =>
      Promise.all([
        result.current.takePhoto(args),
        result.current.takePhoto(args),
      ]),
    );
    expect(output.capturePhoto).toHaveBeenCalledTimes(1);
    expect(result.current.photos).toHaveLength(1);
  });

  /** One photo with the given detections, reviewed and ready to tag. */
  async function captured(
    detections: CapturedDetection[],
    location: CaptureLocation = LOCATION,
  ) {
    const hook = await renderHook(() => useCaptureSession());
    await act(() =>
      hook.result.current.takePhoto({
        photoOutput: photoOutput(["/tmp/1.jpg"]),
        flash: false,
        location,
        heading: 142,
        detections,
      }),
    );
    beginReview();
    await act(() => hook.result.current.startTagging());
    return hook;
  }

  async function save(
    result: { current: ReturnType<typeof useCaptureSession> },
    draft = false,
  ) {
    let saved = false;
    await act(async () => {
      saved = await result.current.save({ draft });
    });
    return saved;
  }

  it("saves one record per accepted detection plus a Home summary", async () => {
    const { result } = await captured([detection(1, 0.9), detection(2, 0.5)]);
    toggleStatus("inclined");
    setFunctional("yes");
    setComment("  leaning  ");

    expect(await save(result)).toBe(true);
    // The undecided 0.5 suggestion is dropped.
    const records = mockAddPole.mock.calls[0][0];
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      latitude: 0.3476,
      longitude: 32.5825,
      accuracy: 2.8,
      altitude: 1190,
      heading: 142,
      category: "energy",
      statuses: ["inclined"],
      suggestedStatuses: [],
      functional: "yes",
      comment: "leaning",
      draft: false,
      flags: [],
      label: "pole",
      trackId: 1,
      detectionConfidence: 0.9,
      reviewStatus: "accepted",
      imageUri: "/tmp/1.jpg",
      modelVersion: "yolo26n_384_xnnpack_fp32.pte",
      synced: false,
    });
    expect(records[0].attributes).toEqual(
      expect.arrayContaining([
        { key: "countInFrame", value: "2", source: "ai", confidence: "high" },
      ]),
    );
    expect(captures$.get()).toEqual([
      expect.objectContaining({
        category: "energy",
        title: "Pole",
        syncStatus: "pending",
        accuracyM: 2.8,
        flagged: false,
      }),
    ]);
    expect(result.current.photos).toEqual([]);
  });

  it("saves accepted suggestions and user corrections, and flags them", async () => {
    const { result } = await captured([detection(1, 0.9), detection(2, 0.5)]);
    rejectDetection(1);
    acceptDetection(2);
    setAttribute(2, "countInFrame", "3");
    await act(() => result.current.startTagging());
    toggleStatus("rust");
    await save(result);

    const records = mockAddPole.mock.calls[0][0];
    expect(records.map((r: { trackId: number }) => r.trackId)).toEqual([2]);
    expect(records[0].attributes).toEqual(
      expect.arrayContaining([
        { key: "countInFrame", value: "3", source: "user", confidence: null },
      ]),
    );
    expect(captures$.get()[0].flagged).toBe(true);
  });

  it("saves a single record when nothing was detected", async () => {
    startSession("auto");
    const { result } = await captured([], {
      ...LOCATION,
      flags: ["gps_unverified"],
    });
    setTagCategory("water");
    toggleStatus("good");
    await save(result);
    expect(mockAddPole.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        imageUri: "/tmp/1.jpg",
        statuses: ["good"],
        functional: "unknown",
        flags: ["gps_unverified"],
      }),
    ]);
    expect(captures$.get()[0]).toMatchObject({
      title: "Water & Sanitation",
      flagged: true,
    });
  });

  it("won't save a record without a status, but saves it as a flagged draft", async () => {
    const { result } = await captured([detection(1, 0.9)]);
    expect(await save(result)).toBe(false);
    expect(mockAddPole).not.toHaveBeenCalled();

    expect(await save(result, true)).toBe(true);
    expect(mockAddPole.mock.calls[0][0][0]).toMatchObject({
      draft: true,
      statuses: [],
    });
    expect(captures$.get()[0].flagged).toBe(true);
  });

  it("checks the stored records for a duplicate and links the update", async () => {
    mockPoles = [
      {
        pid: "uuid-old",
        dhis2Id: "EP-00412",
        category: "energy",
        label: "pole",
        latitude: LOCATION.latitude + 3 / 111_320,
        longitude: LOCATION.longitude,
        timestamp: 0,
      },
    ];
    const { result } = await captured([detection(1, 0.9)]);
    toggleStatus("good");
    // A duplicate needs an answer first.
    expect(await save(result)).toBe(false);

    setDuplicateChoice("update");
    expect(await save(result)).toBe(true);
    expect(mockAddPole.mock.calls[0][0][0]).toMatchObject({
      linkedAssetId: "EP-00412",
      flags: [],
    });
    expect(captures$.get()[0].flagged).toBe(false);
  });

  it("flags a new asset saved next to a possible duplicate", async () => {
    mockPoles = [
      {
        pid: "EP-1",
        category: "energy",
        label: "pole",
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
        timestamp: 0,
      },
    ];
    const { result } = await captured([detection(1, 0.9)]);
    toggleStatus("good");
    setDuplicateChoice("new");
    await save(result);
    expect(mockAddPole.mock.calls[0][0][0]).toMatchObject({
      flags: ["duplicate_nearby"],
    });
    expect(mockAddPole.mock.calls[0][0][0].linkedAssetId).toBeUndefined();
    expect(captures$.get()[0].flagged).toBe(true);
  });

  it("keeps the photos and alerts when saving fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockAddPole.mockRejectedValueOnce(new Error("disk full"));
    const { result } = await captured([]);
    toggleStatus("good");
    expect(await save(result)).toBe(false);
    expect(alert).toHaveBeenCalled();
    expect(result.current.photos).toHaveLength(1);
  });
});
