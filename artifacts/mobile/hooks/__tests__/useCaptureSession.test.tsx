import { MAX_PHOTOS } from "@/constants/Capture";
import { captures, observations, outbox } from "@/db/schema";
import { seedCaptures, setupTestDatabase } from "@/db/testing/TestDb";
import { saveObservations } from "@/services/storage/repos/ObservationRepo";
import { setPhotoQualityChecker } from "@/services/capture/PhotoQuality";
import {
  acceptDetection,
  beginReview,
  editRecord,
  rejectDetection,
  setAttribute,
  setComment,
  setDuplicateChoice,
  setFunctional,
  setTagCategory,
  startSession,
  toggleStatus,
} from "@/services/storage/CaptureSessionStore";
import type { LocalPole } from "@/types/Observation";
import type {
  CaptureLocation,
  CaptureRecord,
  CapturedDetection,
} from "@/types/Capture";
import { act, renderHook } from "@testing-library/react-native";
import { asc, eq } from "drizzle-orm";
import { createAssetAsync } from "expo-media-library";
import { Alert } from "react-native";
import { useCaptureSession } from "../useCaptureSession";

// The durable copy ImageStore makes of each shot (file IO is native).
jest.mock("@/services/storage/ImageStore", () => ({
  ...jest.requireActual("@/services/storage/ImageStore"),
  persistCaptureImage: (uri?: string) =>
    uri ? `file:///docs/${uri.split("/").pop()}` : uri,
}));
jest.mock("@/hooks/Helpers", () => ({
  requestSavePermission: async () => true,
}));
jest.mock("expo-media-library", () => ({
  createAssetAsync: jest.fn(async () => ({})),
}));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: () => `uuid-${String(++mockUuid).padStart(4, "0")}`,
}));

/** A camera engine that returns the next path with the given detections. */
const shooter = (paths: string[], detections: CapturedDetection[] = []) =>
  jest.fn(async () => ({
    path: paths.shift() ?? "/tmp/extra.jpg",
    detections,
  }));

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

const getDb = setupTestDatabase();

/** The stored poles (as the server will get them), in save order. */
const poles = async () =>
  (
    await getDb().orm.select().from(observations).orderBy(asc(observations.pid))
  ).map((r) => r.data as LocalPole & { attributes?: unknown[] });
const rows = async () =>
  (await getDb().orm.select().from(captures)).map((r) => r.summary);

/** Stored records near the fix, for the duplicate check. */
const storePoles = (list: LocalPole[]) =>
  getDb().write((tx) =>
    saveObservations(tx, list, { deviceId: "other-device", now: 1 }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  startSession("energy");
  setPhotoQualityChecker(async () => ({ sharp: true, exposureOk: true }));
});

describe("useCaptureSession", () => {
  it("takes up to three photos, keeps the first location and saves them to the gallery", async () => {
    const shoot = shooter(["/tmp/1.jpg", "/tmp/2.jpg", "/tmp/3.jpg"]);
    const { result } = await renderHook(() => useCaptureSession());
    for (let i = 0; i < MAX_PHOTOS + 1; i++) {
      await act(() =>
        result.current.takePhoto({
          shoot,
          location: { ...LOCATION, latitude: i },
          heading: 142,
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
    expect(shoot).toHaveBeenCalledTimes(3);
    expect(createAssetAsync).toHaveBeenCalledWith("file:///tmp/1.jpg", "photo");
  });

  it("retakes a photo and forgets the location when none are left", async () => {
    const { result } = await renderHook(() => useCaptureSession());
    await act(() =>
      result.current.takePhoto({
        shoot: shooter(["/tmp/1.jpg"]),
        location: LOCATION,
        heading: null,
      }),
    );
    await act(() => result.current.removePhoto(0));
    expect(result.current.photos).toEqual([]);
    expect(result.current.location).toBeNull();
  });

  it("ignores a second tap while a photo is being taken", async () => {
    const shoot = shooter(["/tmp/1.jpg", "/tmp/2.jpg"]);
    const { result } = await renderHook(() => useCaptureSession());
    const args = { shoot, location: LOCATION, heading: null };
    await act(() =>
      Promise.all([
        result.current.takePhoto(args),
        result.current.takePhoto(args),
      ]),
    );
    expect(shoot).toHaveBeenCalledTimes(1);
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
        shoot: shooter(["/tmp/1.jpg"], detections),
        location,
        heading: 142,
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
    const records = await poles();
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
      imageUri: "file:///docs/1.jpg",
      modelVersion: "yolo26n_384_xnnpack_fp32.pte",
      synced: false,
    });
    // Queued for upload in the same transaction.
    expect(
      (await getDb().orm.select().from(outbox)).map((o) => o.entityId),
    ).toEqual([records[0].pid]);
    // Without an AR range the height is left unmeasured.
    expect(records[0].attributes).toEqual(
      expect.arrayContaining([
        { key: "estimatedHeight", value: null, source: "ar", confidence: null },
      ]),
    );
    // Each record points at the photo it was detected in.
    expect(records[0].photoId).toEqual(expect.stringMatching(/^uuid-/));
    expect(await rows()).toEqual([
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

  it("keeps the full record for the detail screen", async () => {
    const { result } = await captured([detection(1, 0.9)]);
    toggleStatus("inclined");
    setComment("leaning");
    expect(await save(result)).toBe(true);

    const [row] = await getDb().orm.select().from(captures);
    const record = row.record!;
    const [pole] = await poles();
    expect(record).toMatchObject({
      category: "energy",
      title: "Pole",
      statuses: ["inclined"],
      comment: "leaning",
      location: { latitude: 0.3476, accuracy: 2.8 },
      photos: [{ uri: "file:///docs/1.jpg" }],
      poleIds: [pole.pid],
    });
    expect(record.id).toBe(row.summary.id);
    expect(record.attributes.length).toBeGreaterThan(0);
  });

  it("saves accepted suggestions and user corrections, and flags them", async () => {
    const { result } = await captured([detection(1, 0.9), detection(2, 0.5)]);
    rejectDetection(1);
    acceptDetection(2);
    setAttribute(2, "vegetationCover", "heavy");
    await act(() => result.current.startTagging());
    toggleStatus("rust");
    await save(result);

    const records = await poles();
    expect(records.map((r) => r.trackId)).toEqual([2]);
    expect(records[0].attributes).toEqual(
      expect.arrayContaining([
        {
          key: "vegetationCover",
          value: "heavy",
          source: "user",
          confidence: null,
        },
      ]),
    );
    expect((await rows())[0].flagged).toBe(true);
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
    expect(await poles()).toEqual([
      expect.objectContaining({
        imageUri: "file:///docs/1.jpg",
        statuses: ["good"],
        functional: "unknown",
        flags: ["gps_unverified"],
      }),
    ]);
    expect((await rows())[0]).toMatchObject({
      title: "Water & Sanitation",
      flagged: true,
    });
  });

  it("won't save a record without a status, but saves it as a flagged draft", async () => {
    const { result } = await captured([detection(1, 0.9)]);
    expect(await save(result)).toBe(false);
    expect(await poles()).toEqual([]);

    expect(await save(result, true)).toBe(true);
    expect((await poles())[0]).toMatchObject({
      draft: true,
      statuses: [],
    });
    expect((await rows())[0].flagged).toBe(true);
  });

  it("checks the stored records for a duplicate and links the update", async () => {
    await storePoles([
      {
        pid: "old",
        dhis2Id: "EP-00412",
        category: "energy",
        label: "pole",
        latitude: LOCATION.latitude + 3 / 111_320,
        longitude: LOCATION.longitude,
        timestamp: 0,
      },
      // Far away: never read by the neighbourhood query.
      {
        pid: "far",
        category: "energy",
        label: "pole",
        latitude: 1.5,
        longitude: 33,
        timestamp: 0,
      },
    ]);
    const { result } = await captured([detection(1, 0.9)]);
    toggleStatus("good");
    // A duplicate needs an answer first.
    expect(await save(result)).toBe(false);

    setDuplicateChoice("update");
    expect(await save(result)).toBe(true);
    const [saved] = (await poles()).filter(
      (p) => p.pid !== "old" && p.pid !== "far",
    );
    expect(saved).toMatchObject({
      linkedAssetId: "EP-00412",
      flags: [],
    });
    expect((await rows())[0].flagged).toBe(false);
  });

  it("flags a new asset saved next to a possible duplicate", async () => {
    await storePoles([
      {
        pid: "EP-1",
        category: "energy",
        label: "pole",
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
        timestamp: 0,
      },
    ]);
    const { result } = await captured([detection(1, 0.9)]);
    toggleStatus("good");
    setDuplicateChoice("new");
    await save(result);
    const [saved] = (await poles()).filter((p) => p.pid !== "EP-1");
    expect(saved).toMatchObject({ flags: ["duplicate_nearby"] });
    expect(saved.linkedAssetId).toBeUndefined();
    expect((await rows())[0].flagged).toBe(true);
  });

  it("keeps the photos and alerts when saving fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await getDb().exec(
      "CREATE TRIGGER full BEFORE INSERT ON captures BEGIN SELECT RAISE(ABORT, 'disk full'); END",
    );
    const { result } = await captured([]);
    toggleStatus("good");
    expect(await save(result)).toBe(false);
    expect(alert).toHaveBeenCalled();
    expect(result.current.photos).toHaveLength(1);
    // One transaction: the poles weren't stored without their row either.
    expect(await poles()).toEqual([]);
  });

  describe("editing a saved record", () => {
    const RECORD: CaptureRecord = {
      id: "r1",
      category: "energy",
      title: "Concrete pole",
      assetId: "EP-00412",
      capturedAt: "2026-09-22T10:14:00.000Z",
      photos: [{ uri: null }],
      location: LOCATION,
      attributes: [],
      statuses: ["inclined"],
      suggestedStatuses: ["inclined"],
      functional: "unknown",
      comment: "",
      poleIds: ["p1", "p2"],
    };

    beforeEach(async () => {
      await seedCaptures(
        getDb(),
        [
          {
            id: "r1",
            category: "energy",
            title: "Concrete pole",
            detail: "2 detections",
            capturedAt: RECORD.capturedAt,
            accuracyM: 2.8,
            syncStatus: "synced",
            flagged: false,
          },
        ],
        { records: { r1: RECORD } },
      );
      // Only p1 is on this device (p2 was never downloaded).
      await storePoles([{ pid: "p1", latitude: 0, longitude: 0 }]);
      await getDb().write((tx) => tx.delete(outbox));
      editRecord(RECORD);
    });

    const r1 = async () =>
      (
        await getDb().orm.select().from(captures).where(eq(captures.id, "r1"))
      )[0];

    it("saves the form to the record, its queued records and its row", async () => {
      const { result } = await renderHook(() => useCaptureSession());
      expect(result.current.editingId).toBe("r1");
      toggleStatus("cracked");
      setComment(" snapped ");
      expect(await save(result)).toBe(true);

      // Only poles on this device get the change, queued for upload.
      expect(await poles()).toEqual([
        expect.objectContaining({
          pid: "p1",
          category: "energy",
          statuses: ["inclined", "cracked"],
          suggestedStatuses: ["inclined"],
          functional: "unknown",
          comment: "snapped",
        }),
      ]);
      expect(
        (await getDb().orm.select().from(outbox)).map((o) => [
          o.entityId,
          o.op,
        ]),
      ).toEqual([["p1", "update"]]);
      const row = await r1();
      expect(row.record).toMatchObject({
        statuses: ["inclined", "cracked"],
        comment: "snapped",
        photos: [{ uri: null }],
      });
      expect(row.summary).toMatchObject({
        id: "r1",
        detail: "2 detections",
        syncStatus: "pending",
      });
      expect(result.current.editingId).toBeNull();
    });

    it("won't save an edit that leaves no status", async () => {
      const { result } = await renderHook(() => useCaptureSession());
      toggleStatus("inclined");
      expect(await save(result)).toBe(false);
      expect((await r1()).record?.statuses).toEqual(["inclined"]);
    });
  });
});
