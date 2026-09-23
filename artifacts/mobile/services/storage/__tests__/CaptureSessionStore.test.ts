import { setDetectionEstimator } from "@/services/capture/AttributeEstimator";
import { setNearbyAssetSource } from "@/services/capture/NearbyAssets";
import { setStatusSuggester } from "@/services/capture/StatusSuggester";
import {
  acceptDetection,
  addPhoto,
  appendComment,
  beginReview,
  beginTagging,
  captureSession$,
  editRecord,
  rejectDetection,
  removePhoto,
  resetSession,
  setAttribute,
  setComment,
  setDuplicateChoice,
  setFunctional,
  setTagCategory,
  startSession,
  toggleStatus,
  undoRejection,
} from "@/services/storage/CaptureSessionStore";
import type {
  CaptureLocation,
  CapturedDetection,
  CapturedPhoto,
  NearbyAsset,
} from "@/types/Capture";

const LOCATION: CaptureLocation = {
  latitude: 0.3476,
  longitude: 32.5825,
  accuracy: 2.8,
  altitude: 1190,
  satellites: 18,
  flags: [],
};

const detection = (
  trackId: number,
  confidence: number,
  label = "pole",
): CapturedDetection => ({
  trackId,
  label,
  confidence,
  box: { xmin: 0.1, ymin: 0.1, xmax: 0.3, ymax: 0.9 },
});

const photo = (
  imageUri: string,
  detections: CapturedDetection[] = [],
): CapturedPhoto => ({
  imageUri,
  capturedAt: 0,
  heading: null,
  detections,
  quality: { sharp: null, exposureOk: null },
});

const decisions = () =>
  captureSession$.detections.peek().map((d) => [d.trackId, d.decision]);

beforeEach(() => {
  setDetectionEstimator();
  setStatusSuggester();
  setNearbyAssetSource();
  startSession("energy");
});

describe("CaptureSessionStore", () => {
  it("stamps the location from the first photo only", () => {
    addPhoto(photo("/tmp/1.jpg"), LOCATION);
    addPhoto(photo("/tmp/2.jpg"), { ...LOCATION, latitude: 9 });
    expect(captureSession$.photos.peek()).toHaveLength(2);
    expect(captureSession$.location.peek()?.latitude).toBe(0.3476);
  });

  it("forgets the location once every photo is retaken", () => {
    addPhoto(photo("/tmp/1.jpg"), LOCATION);
    removePhoto(0);
    expect(captureSession$.photos.peek()).toEqual([]);
    expect(captureSession$.location.peek()).toBeNull();
  });

  it("builds review rows from merged detections with §6.3 decisions", () => {
    addPhoto(
      photo("/tmp/1.jpg", [detection(1, 0.91), detection(2, 0.64)]),
      LOCATION,
    );
    addPhoto(photo("/tmp/2.jpg", [detection(2, 0.66)]), LOCATION);
    beginReview();

    const [first, second] = captureSession$.detections.peek();
    expect(decisions()).toEqual([
      [1, "accepted"],
      [2, "suggested"],
    ]);
    expect(second).toMatchObject({ confidence: 0.66, imageUri: "/tmp/2.jpg" });
    expect(first.attributes.map((a) => a.key)).toEqual([
      "material",
      "inclination",
      "estimatedAge",
      "vegetationCover",
      "countInFrame",
      "distanceFromRoad",
    ]);
  });

  it("accepts, rejects and undoes", () => {
    addPhoto(
      photo("/tmp/1.jpg", [detection(1, 0.91), detection(2, 0.5)]),
      LOCATION,
    );
    beginReview();

    acceptDetection(2);
    rejectDetection(1);
    expect(decisions()).toEqual([
      [1, "rejected"],
      [2, "accepted"],
    ]);
    undoRejection(1);
    expect(decisions()).toEqual([
      [1, "accepted"],
      [2, "accepted"],
    ]);
  });

  it("makes a corrected value the surveyor's", () => {
    addPhoto(photo("/tmp/1.jpg", [detection(1, 0.91)]), LOCATION);
    beginReview();
    setAttribute(1, "countInFrame", "3");
    expect(
      captureSession$.detections
        .peek()[0]
        .attributes.find((a) => a.key === "countInFrame"),
    ).toEqual({
      key: "countInFrame",
      value: "3",
      source: "user",
      confidence: null,
    });
  });

  it("keeps decisions and corrections when a photo is added and reviewed again", () => {
    addPhoto(
      photo("/tmp/1.jpg", [detection(1, 0.91), detection(2, 0.5)]),
      LOCATION,
    );
    beginReview();
    rejectDetection(1);
    setAttribute(1, "countInFrame", "2");

    addPhoto(photo("/tmp/2.jpg", [detection(3, 0.8)]), LOCATION);
    beginReview();
    expect(decisions()).toEqual([
      [1, "rejected"],
      [2, "suggested"],
      [3, "accepted"],
    ]);
    expect(
      captureSession$.detections
        .peek()[0]
        .attributes.find((a) => a.key === "countInFrame")?.source,
    ).toBe("user");
  });

  it("resets to an empty session in the same category", () => {
    addPhoto(photo("/tmp/1.jpg", [detection(1, 0.91)]), LOCATION);
    beginReview();
    resetSession();
    expect(captureSession$.peek()).toMatchObject({
      category: "energy",
      photos: [],
      location: null,
      detections: [],
      tagging: null,
    });
  });
});

describe("CaptureSessionStore tagging", () => {
  const POLE_NEARBY: NearbyAsset = {
    id: "EP-00412",
    category: "energy",
    label: "pole",
    latitude: LOCATION.latitude + 3.2 / 111_320,
    longitude: LOCATION.longitude,
    capturedAt: 0,
  };

  function reviewed() {
    addPhoto(photo("/tmp/1.jpg", [detection(1, 0.91)]), LOCATION);
    beginReview();
  }

  it("does nothing before the form is opened", () => {
    toggleStatus("rust");
    setComment("x");
    expect(captureSession$.tagging.peek()).toBeNull();
  });

  it("opens with the category, AI statuses, unknown functional and no duplicate", () => {
    setStatusSuggester(() => ["inclined"]);
    reviewed();
    beginTagging();
    expect(captureSession$.tagging.peek()).toEqual({
      category: "energy",
      statuses: ["inclined"],
      suggested: ["inclined"],
      functional: "unknown",
      comment: "",
      duplicate: null,
      duplicateChoice: null,
    });
  });

  it("resolves an AI-picked category from the kept detections", () => {
    startSession("auto");
    reviewed();
    beginTagging();
    expect(captureSession$.tagging.peek()?.category).toBe("energy");
  });

  it("finds a possible duplicate among the known assets", () => {
    reviewed();
    beginTagging([POLE_NEARBY]);
    expect(captureSession$.tagging.peek()?.duplicate).toMatchObject({
      id: "EP-00412",
    });
    expect(captureSession$.nearby.peek()).toEqual([POLE_NEARBY]);
  });

  it("edits the form", () => {
    reviewed();
    beginTagging();
    toggleStatus("rust");
    toggleStatus("cracked");
    setFunctional("no");
    setComment("Leaning.");
    appendComment("After rain.");
    expect(captureSession$.tagging.peek()).toMatchObject({
      statuses: ["rust", "cracked"],
      functional: "no",
      comment: "Leaning. After rain.",
    });
    toggleStatus("good");
    expect(captureSession$.tagging.peek()?.statuses).toEqual(["good"]);
  });

  it("re-checks statuses and duplicates for a new category", () => {
    setStatusSuggester(() => ["inclined", "leaking"]);
    reviewed();
    beginTagging([POLE_NEARBY]);
    toggleStatus("sagging_lines");
    expect(captureSession$.tagging.peek()?.statuses).toEqual([
      "inclined",
      "sagging_lines",
    ]);

    setTagCategory("water");
    expect(captureSession$.tagging.peek()).toMatchObject({
      category: "water",
      statuses: ["leaking"],
      suggested: ["leaking"],
      duplicate: null,
    });
  });

  it("keeps the surveyor's answers when coming back from review", () => {
    setStatusSuggester(() => ["inclined"]);
    reviewed();
    beginTagging([POLE_NEARBY]);
    toggleStatus("inclined");
    toggleStatus("rust");
    setFunctional("yes");
    setComment("note");
    setDuplicateChoice("update");

    beginReview();
    beginTagging([POLE_NEARBY]);
    expect(captureSession$.tagging.peek()).toMatchObject({
      statuses: ["rust"],
      functional: "yes",
      comment: "note",
      duplicateChoice: "update",
    });
  });

  it("forgets the duplicate answer when the candidate changes", () => {
    reviewed();
    beginTagging([POLE_NEARBY]);
    setDuplicateChoice("new");
    beginTagging([{ ...POLE_NEARBY, id: "EP-9" }]);
    expect(captureSession$.tagging.peek()?.duplicateChoice).toBeNull();
  });

  it("opens a saved record in the tagging form, and a new session drops it", () => {
    editRecord({
      id: "r1",
      category: "water",
      title: "Borehole",
      capturedAt: "2026-09-22T10:14:00.000Z",
      photos: [],
      location: LOCATION,
      attributes: [],
      statuses: ["leaking"],
      suggestedStatuses: [],
      functional: "no",
      comment: "Drips",
      poleIds: [],
    });
    expect(captureSession$.peek()).toMatchObject({
      category: "water",
      location: LOCATION,
      photos: [],
      detections: [],
      editingId: "r1",
      tagging: {
        category: "water",
        statuses: ["leaking"],
        suggested: [],
        functional: "no",
        comment: "Drips",
        duplicate: null,
      },
    });
    startSession("energy");
    expect(captureSession$.editingId.peek()).toBeNull();
  });
});
