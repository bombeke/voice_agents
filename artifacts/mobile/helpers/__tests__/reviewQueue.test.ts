import type { ReviewItem, ReviewReason } from "@/types/Review";
import {
  CATEGORY_CODES,
  filterReviews,
  formatReviewMeta,
  formatReviewReason,
} from "../reviewQueue";

const NOW = new Date(2026, 8, 24, 10, 0);
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString();

const item = (id: string, reason: ReviewReason, capturedAt: string) =>
  ({
    id,
    category: "roads",
    title: "Culvert · pipe",
    enumerator: "Enumerator 04",
    capturedAt,
    reason,
  }) satisfies ReviewItem;

const ITEMS = [
  item("edits", { kind: "heavy_edits", edited: 4, total: 6 }, at(23, 15)),
  item("ai", { kind: "low_confidence", confidence: 0.52 }, at(24, 9, 20)),
  item("gps", { kind: "gps_unverified", accuracyM: 6.1 }, at(24, 8, 12)),
  item("dup", { kind: "duplicate", distanceM: 1.8 }, at(23, 11)),
];
const ids = (items: ReviewItem[]) => items.map((i) => i.id);

describe("filterReviews", () => {
  it("lists every reason under All, newest first", () => {
    expect(ids(filterReviews(ITEMS, "all"))).toEqual([
      "ai",
      "gps",
      "edits",
      "dup",
    ]);
  });

  it("narrows to one reason; heavy edits only show under All", () => {
    expect(ids(filterReviews(ITEMS, "low_confidence"))).toEqual(["ai"]);
    expect(ids(filterReviews(ITEMS, "gps"))).toEqual(["gps"]);
    expect(ids(filterReviews(ITEMS, "duplicate"))).toEqual(["dup"]);
  });

  it("doesn't reorder the input", () => {
    const input = [...ITEMS];
    filterReviews(input, "all");
    expect(input).toEqual(ITEMS);
  });
});

describe("formatReviewReason", () => {
  it("writes each reason with its evidence", () => {
    expect(ITEMS.map((i) => formatReviewReason(i.reason))).toEqual([
      "Heavy edits (4 of 6 attributes)",
      "Low AI confidence (0.52)",
      "GPS unverified (±6.1 m draft)",
      "Possible duplicate (1.8 m)",
    ]);
  });
});

describe("formatReviewMeta", () => {
  it("shows the time today, 'yesterday', then the date", () => {
    expect(formatReviewMeta(ITEMS[1], NOW)).toBe("Enumerator 04 · today 09:20");
    expect(formatReviewMeta(ITEMS[0], NOW)).toBe("Enumerator 04 · yesterday");
    const older = item("old", ITEMS[0].reason, at(21, 9));
    expect(formatReviewMeta(older, NOW)).toMatch(/^Enumerator 04 · Mon 21 Sep/);
  });
});

describe("CATEGORY_CODES", () => {
  it("matches the asset ID prefixes", () => {
    expect(CATEGORY_CODES).toEqual({
      energy: "EP",
      water: "WS",
      telecom: "TC",
      roads: "RD",
    });
  });
});
