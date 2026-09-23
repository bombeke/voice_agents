import type { CaptureRecord } from "@/types/Capture";
import {
  clearRecords,
  records$,
  replaceRecords,
  upsertRecord,
} from "../RecordStore";

const record = (id: string, comment = ""): CaptureRecord => ({
  id,
  category: "water",
  title: "Borehole",
  capturedAt: "2026-09-23T09:00:00.000Z",
  photos: [],
  location: {
    latitude: 0,
    longitude: 0,
    accuracy: 2,
    altitude: null,
    satellites: null,
    flags: [],
  },
  attributes: [],
  statuses: ["good"],
  suggestedStatuses: ["good"],
  functional: "yes",
  comment,
  poleIds: [],
});

beforeEach(() => clearRecords());

describe("RecordStore", () => {
  it("replaces the store keyed by id", () => {
    replaceRecords([record("a"), record("b")]);
    expect(Object.keys(records$.get())).toEqual(["a", "b"]);
  });

  it("upserts without mutating what readers already hold", () => {
    replaceRecords([record("a")]);
    const before = records$.get();
    upsertRecord(record("a", "edited"));
    upsertRecord(record("b"));
    const after = records$.get();
    expect(after).not.toBe(before);
    expect(before.a.comment).toBe("");
    expect(after.a.comment).toBe("edited");
    expect(Object.keys(after)).toEqual(["a", "b"]);
  });
});
