import type { CaptureSummary } from "@/types/Capture";
import {
  formatCaptureMeta,
  latestCapture,
  summariseToday,
} from "../captureStats";
import { fill } from "../format";

const NOW = new Date(2026, 8, 23, 15, 0);
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString();

const capture = (extra: Partial<CaptureSummary> = {}): CaptureSummary => ({
  id: "c1",
  category: "energy",
  title: "Concrete pole · inclined 7°",
  capturedAt: at(23, 10, 14),
  accuracyM: 2.8,
  syncStatus: "synced",
  flagged: false,
  ...extra,
});

describe("summariseToday", () => {
  it("counts today's captures, synced and flagged", () => {
    const stats = summariseToday(
      [
        capture({ id: "a" }),
        capture({ id: "b", flagged: true }),
        capture({ id: "c", syncStatus: "pending" }),
      ],
      NOW,
    );
    expect(stats).toEqual({
      capturedToday: 3,
      synced: 2,
      flagged: 1,
      pending: 1,
    });
  });

  it("leaves yesterday out of today's counts but keeps its pending record", () => {
    const stats = summariseToday(
      [
        capture({
          id: "old",
          capturedAt: at(22, 23, 59),
          syncStatus: "failed",
        }),
        capture({ id: "old2", capturedAt: at(22, 9), flagged: true }),
      ],
      NOW,
    );
    expect(stats).toEqual({
      capturedToday: 0,
      synced: 0,
      flagged: 0,
      pending: 1,
    });
  });

  it("returns zeros for an empty store", () => {
    expect(summariseToday([], NOW)).toEqual({
      capturedToday: 0,
      synced: 0,
      flagged: 0,
      pending: 0,
    });
  });
});

describe("latestCapture", () => {
  it("picks the newest capture regardless of order", () => {
    const newest = capture({ id: "new", capturedAt: at(23, 14) });
    expect(
      latestCapture([capture({ id: "a" }), newest, capture({ id: "b" })]),
    ).toBe(newest);
  });

  it("is undefined when nothing was captured", () => {
    expect(latestCapture([])).toBeUndefined();
  });
});

describe("formatCaptureMeta", () => {
  it("shows local time, accuracy and sync state", () => {
    expect(formatCaptureMeta(capture({ syncStatus: "pending" }))).toBe(
      "10:14 · ±2.8 m · waiting to sync",
    );
    expect(
      formatCaptureMeta(capture({ capturedAt: at(23, 9, 5), accuracyM: 3 })),
    ).toBe("09:05 · ±3.0 m · synced");
  });
});

describe("fill", () => {
  it("replaces known placeholders and keeps unknown ones", () => {
    expect(fill("{count} pending in {org}", { count: 3 })).toBe(
      "3 pending in {org}",
    );
  });
});
