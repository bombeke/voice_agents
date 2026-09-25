import {
  applyTagEdit,
  buildRecord,
  buildRecords,
  buildSummary,
  recordFlags,
  tagFormFromRecord,
  type RecordInput,
} from "@/helpers/captureRecord";
import type { CaptureRecord, ReviewDetection } from "@/types/Capture";

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
        id: "photo-1",
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

describe("buildRecord", () => {
  it("keeps what the detail screen shows, with the stored photos", () => {
    const attributes = [
      {
        key: "material" as const,
        value: "concrete",
        source: "ai" as const,
        confidence: "high" as const,
      },
    ];
    const data = input({
      detections: [detection({ attributes })],
      form: { ...input().form, duplicate: DUPLICATE, duplicateChoice: "new" },
    });
    const records = buildRecords(data);
    const summary = buildSummary(records, data);
    const record = buildRecord(summary, records, data, ["file:///docs/1.jpg"]);
    expect(record).toEqual({
      id: "id-1",
      category: "energy",
      title: "Pole",
      capturedAt: "2026-09-23T09:20:00.000Z",
      photos: [{ uri: "file:///docs/1.jpg" }],
      location: expect.objectContaining({
        latitude: 0.3136,
        flags: ["duplicate_nearby"],
      }),
      attributes,
      statuses: ["inclined"],
      suggestedStatuses: ["inclined"],
      functional: "no",
      comment: "note",
      poleIds: ["id-1"],
    });
  });

  it("names who captured it on the record, its row and the upload", () => {
    const capturedBy = { id: "field", name: "Field Enumerator" };
    const data = input({ capturedBy });
    const records = buildRecords(data);
    const summary = buildSummary(records, data);
    expect(records[0].capturedBy).toBe("field");
    expect(summary.capturedBy).toEqual(capturedBy);
    expect(buildRecord(summary, records, data, []).capturedBy).toEqual(
      capturedBy,
    );
  });

  it("has no attributes when no detection was kept", () => {
    const data = input({ detections: [] });
    const records = buildRecords(data);
    const record = buildRecord(buildSummary(records, data), records, data, []);
    expect(record.attributes).toEqual([]);
    expect(record.photos).toEqual([]);
  });
});

describe("editing a saved record", () => {
  const RECORD: CaptureRecord = {
    id: "r1",
    category: "energy",
    title: "Concrete pole",
    assetId: "EP-00412",
    capturedAt: "2026-09-22T10:14:00.000Z",
    photos: [],
    location: input().location,
    attributes: [],
    statuses: ["inclined"],
    suggestedStatuses: ["inclined"],
    functional: "unknown",
    comment: "old",
    poleIds: ["p1"],
  };
  const SUMMARY = {
    id: "r1",
    category: "energy" as const,
    title: "Concrete pole",
    detail: "inclined",
    capturedAt: RECORD.capturedAt,
    accuracyM: 2.8,
    syncStatus: "synced" as const,
    flagged: true,
  };

  it("opens the form with the record's answers and no duplicate question", () => {
    expect(tagFormFromRecord(RECORD)).toEqual({
      category: "energy",
      statuses: ["inclined"],
      suggested: ["inclined"],
      functional: "unknown",
      comment: "old",
      duplicate: null,
      duplicateChoice: null,
    });
  });

  it("applies the form and puts the row back to pending", () => {
    const edit = applyTagEdit(RECORD, SUMMARY, {
      ...tagFormFromRecord(RECORD),
      category: "energy",
      statuses: ["cracked"],
      functional: "no",
      comment: " snapped ",
    });
    expect(edit.record).toMatchObject({
      statuses: ["cracked"],
      functional: "no",
      comment: "snapped",
      poleIds: ["p1"],
    });
    expect(edit.summary).toEqual({
      ...SUMMARY,
      detail: "Cracked / damaged",
      syncStatus: "pending",
    });
    expect(edit.poleFields).toEqual({
      category: "energy",
      statuses: ["cracked"],
      suggestedStatuses: ["inclined"],
      functional: "no",
      comment: "snapped",
    });
  });
});

describe("buildRecords with a ranged asset", () => {
  it("places the record at the asset and keeps the phone's fix and photo metadata", () => {
    const metadata = { engine: "ar" } as never;
    const base = input();
    const records = buildRecords(
      input({
        photos: [{ ...base.photos[0], metadata }],
        detections: [
          detection({
            photoId: "photo-1",
            position: {
              latitude: 0.31358,
              longitude: 32.581061,
              altitude: 1188.5,
              distanceM: 12.4,
              slantDistanceM: 12.5,
              bearingDeg: 142,
              accuracyM: 3.1,
              projectionErrorM: 1.2,
              source: "ar_auto",
              hitType: "ExistingPlaneUsingExtent",
              arPoint: [7.6, 0, 9.8],
              rough: false,
            },
            positionEdited: true,
          }),
        ],
      }),
    );
    expect(records[0]).toMatchObject({
      latitude: 0.31358,
      longitude: 32.581061,
      accuracy: 3.1,
      altitude: 1188.5,
      photoId: "photo-1",
      devicePosition: { latitude: 0.3136, longitude: 32.5811 },
      captureMetadata: metadata,
    });
    expect(records[0]).not.toHaveProperty("positionEdited");
  });

  it("keeps the phone's fix for an unranged asset", () => {
    const [record] = buildRecords(input());
    expect(record).toMatchObject({ latitude: 0.3136, longitude: 32.5811 });
  });
});
