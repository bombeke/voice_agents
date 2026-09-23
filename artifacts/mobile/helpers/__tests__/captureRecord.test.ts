import {
  buildRecords,
  buildSummary,
  recordFlags,
  type RecordInput,
} from "@/helpers/captureRecord";
import type { ReviewDetection } from "@/types/Capture";

const detection = (over: Partial<ReviewDetection> = {}): ReviewDetection => ({
  trackId: 1,
  label: "pole",
  confidence: 0.91,
  box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 },
  imageUri: "/tmp/1.jpg",
  decision: "accepted",
  attributes: [],
  ...over,
});

const DUPLICATE = {
  id: "EP-00412",
  category: "energy" as const,
  label: "pole",
  latitude: 0,
  longitude: 0,
  capturedAt: 0,
  distanceM: 3.2,
};

function input(over: Partial<RecordInput> = {}): RecordInput {
  let id = 0;
  return {
    photos: [
      {
        imageUri: "/tmp/1.jpg",
        capturedAt: Date.parse("2026-09-23T09:20:00Z"),
        heading: null,
        detections: [],
        quality: { sharp: true, exposureOk: true },
      },
    ],
    location: {
      latitude: 0.3136,
      longitude: 32.5811,
      accuracy: null,
      altitude: null,
      satellites: null,
      flags: [],
    },
    detections: [detection(), detection({ trackId: 2, decision: "rejected" })],
    form: {
      category: "energy",
      statuses: ["inclined"],
      suggested: ["inclined"],
      functional: "no",
      comment: " note ",
      duplicate: null,
      duplicateChoice: null,
    },
    draft: false,
    modelVersion: "model",
    newId: () => `id-${++id}`,
    ...over,
  };
}

describe("buildRecords", () => {
  it("writes one record per accepted detection with the form's fields", () => {
    const records = buildRecords(input());
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      pid: "id-1",
      trackId: 1,
      statuses: ["inclined"],
      suggestedStatuses: ["inclined"],
      functional: "no",
      comment: "note",
      draft: false,
      accuracy: undefined,
      altitude: undefined,
      linkedAssetId: undefined,
    });
  });

  it("links an update to the existing asset", () => {
    const base = input();
    const records = buildRecords({
      ...base,
      form: { ...base.form, duplicate: DUPLICATE, duplicateChoice: "update" },
    });
    expect(records[0].linkedAssetId).toBe("EP-00412");
  });
});

describe("recordFlags", () => {
  it("adds duplicate_nearby only for a new asset beside a duplicate", () => {
    const base = input();
    expect(
      recordFlags({
        location: { ...base.location, flags: ["mock_location"] },
        form: { ...base.form, duplicate: DUPLICATE, duplicateChoice: "new" },
      }),
    ).toEqual(["mock_location", "duplicate_nearby"]);
    expect(
      recordFlags({
        location: base.location,
        form: { ...base.form, duplicate: DUPLICATE, duplicateChoice: "update" },
      }),
    ).toEqual([]);
  });
});

describe("buildSummary", () => {
  it("summarises the capture for Home, flagging drafts", () => {
    const base = input();
    const records = buildRecords(base);
    expect(buildSummary(records, base)).toEqual({
      id: "id-1",
      category: "energy",
      title: "Pole",
      detail: "Inclined",
      capturedAt: "2026-09-23T09:20:00.000Z",
      accuracyM: 0,
      syncStatus: "pending",
      flagged: false,
    });
    expect(buildSummary(records, { ...base, draft: true }).flagged).toBe(true);
  });

  it("counts several kept detections in the detail", () => {
    const base = input({
      detections: [detection(), detection({ trackId: 2 })],
    });
    expect(buildSummary(buildRecords(base), base).detail).toBe("2 detections");
  });

  it("falls back to whether the asset works, then to nothing", () => {
    const base = input();
    const good = { ...base.form, statuses: ["good" as const] };
    const summary = (form: RecordInput["form"]) =>
      buildSummary(buildRecords({ ...base, form }), { ...base, form });
    expect(summary({ ...good, functional: "yes" }).detail).toBe("functional");
    expect(summary({ ...good, functional: "unknown" }).detail).toBeUndefined();
  });

  it("links an update to the existing asset's code", () => {
    const base = input();
    const form = {
      ...base.form,
      duplicate: DUPLICATE,
      duplicateChoice: "update" as const,
    };
    const summary = buildSummary(buildRecords({ ...base, form }), {
      ...base,
      form,
    });
    expect(summary.assetId).toBe("EP-00412");
    expect(buildSummary(buildRecords(base), base)).not.toHaveProperty(
      "assetId",
    );
  });
});
