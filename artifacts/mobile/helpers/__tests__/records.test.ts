import type { CaptureSummary } from "@/types/Capture";
import {
  countRecords,
  filterRecords,
  findRecord,
  formatRecordMeta,
  groupByDay,
  isRecordFilter,
  recordBadge,
} from "../records";

const NOW = new Date(2026, 8, 23, 15, 0);
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString();

const record = (extra: Partial<CaptureSummary> = {}): CaptureSummary => ({
  id: "r1",
  category: "energy",
  title: "Concrete pole",
  detail: "2 detections",
  capturedAt: at(23, 10, 14),
  accuracyM: 2.8,
  syncStatus: "synced",
  flagged: false,
  ...extra,
});

const RECORDS = [
  record({ id: "pole", syncStatus: "pending", assetId: "EP-00412" }),
  record({
    id: "culvert",
    category: "roads",
    title: "Culvert · pipe",
    detail: "partly blocked",
    flagged: true,
  }),
  record({
    id: "borehole",
    category: "water",
    title: "Borehole · hand pump",
    detail: "functional",
    syncStatus: "failed",
  }),
  record({ id: "mast", category: "telecom", title: "Telecom mast" }),
];

describe("countRecords", () => {
  it("counts every tab plus uploading and failed", () => {
    expect(
      countRecords([
        ...RECORDS,
        record({ id: "up", syncStatus: "uploading", flagged: true }),
      ]),
    ).toEqual({ all: 5, pending: 3, flagged: 2, uploading: 1, failed: 1 });
  });
});

describe("filterRecords", () => {
  const ids = (list: CaptureSummary[]) => list.map((c) => c.id);

  it("keeps unsynced records under pending and flagged ones under flagged", () => {
    expect(ids(filterRecords(RECORDS, "all", ""))).toHaveLength(4);
    expect(ids(filterRecords(RECORDS, "pending", ""))).toEqual([
      "pole",
      "borehole",
    ]);
    expect(ids(filterRecords(RECORDS, "flagged", ""))).toEqual(["culvert"]);
  });

  it.each([
    ["name", "BOREHOLE", ["borehole"]],
    ["detail", "blocked", ["culvert"]],
    ["asset code", "ep-004", ["pole"]],
    ["category", "telecom", ["mast"]],
    ["nothing", "tower", []],
  ])("searches by %s", (_, query, expected) => {
    expect(ids(filterRecords(RECORDS, "all", `  ${query} `))).toEqual(expected);
  });

  it("applies the tab and the search together", () => {
    expect(ids(filterRecords(RECORDS, "pending", "pole"))).toEqual(["pole"]);
    expect(ids(filterRecords(RECORDS, "flagged", "pole"))).toEqual([]);
  });
});

describe("groupByDay", () => {
  it("sorts newest first into today, yesterday and dated sections", () => {
    const sections = groupByDay(
      [
        record({ id: "old", capturedAt: at(21, 9) }),
        record({ id: "early", capturedAt: at(23, 0, 1) }),
        record({ id: "late", capturedAt: at(22, 23, 59) }),
        record({ id: "now", capturedAt: at(23, 14) }),
      ],
      NOW,
    );
    expect(sections.map((s) => [s.title, s.data.map((c) => c.id)])).toEqual([
      ["Today", ["now", "early"]],
      ["Yesterday", ["late"]],
      ["Mon 21 Sept", ["old"]],
    ]);
    expect(sections.map((s) => s.key)).toEqual([
      "2026-09-23",
      "2026-09-22",
      "2026-09-21",
    ]);
  });

  it("returns no sections for no records", () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});

describe("recordBadge", () => {
  it.each<[Partial<CaptureSummary>, string]>([
    [{ syncStatus: "synced" }, "synced"],
    [{ syncStatus: "pending" }, "pending"],
    [{ syncStatus: "uploading" }, "uploading"],
    [{ syncStatus: "pending", flagged: true }, "flagged"],
    [{ syncStatus: "failed", flagged: true }, "failed"],
  ])("shows %o as %s", (extra, badge) => {
    expect(recordBadge(record(extra))).toBe(badge);
  });
});

describe("formatRecordMeta", () => {
  it("joins time, accuracy and detail", () => {
    expect(formatRecordMeta(record())).toBe("10:14 · ±2.8 m · 2 detections");
    expect(formatRecordMeta(record({ detail: undefined, accuracyM: 3 }))).toBe(
      "10:14 · ±3.0 m",
    );
  });
});

describe("findRecord", () => {
  it("finds by capture id or the newest record of an asset code", () => {
    const list = [
      record({ id: "a", assetId: "EP-1", capturedAt: at(22, 9) }),
      record({ id: "b", assetId: "EP-1", capturedAt: at(23, 9) }),
    ];
    expect(findRecord(list, "a")?.id).toBe("a");
    expect(findRecord(list, "EP-1")?.id).toBe("b");
    expect(findRecord(list, "EP-2")).toBeUndefined();
  });
});

describe("isRecordFilter", () => {
  it("accepts only the tab names", () => {
    expect(isRecordFilter("pending")).toBe(true);
    expect(isRecordFilter("synced")).toBe(false);
    expect(isRecordFilter(undefined)).toBe(false);
  });
});
