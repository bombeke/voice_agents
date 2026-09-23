import type { CaptureRecord } from "@/types/Capture";
import {
  conditionSummary,
  formatCapturedAt,
  formatCapturedLine,
  formatStatuses,
  photoCounter,
  recordHistory,
  splitAttributes,
  statusSource,
} from "../recordDetail";

const at = (month: number, day: number, hour = 10, minute = 14) =>
  new Date(2026, month - 1, day, hour, minute).toISOString();

const record = (over: Partial<CaptureRecord> = {}): CaptureRecord => ({
  id: "now",
  category: "energy",
  title: "Concrete pole",
  assetId: "EP-00412",
  capturedAt: at(9, 22),
  photos: [{ uri: null }],
  location: {
    latitude: 0.313612,
    longitude: 32.581104,
    accuracy: 2.8,
    altitude: 1203.4,
    satellites: null,
    flags: [],
  },
  attributes: [
    { key: "material", value: "concrete", source: "ai", confidence: "high" },
    { key: "inclination", value: "7", source: "ai", confidence: "medium" },
    {
      key: "vegetationCover",
      value: "partial",
      source: "ai",
      confidence: "high",
    },
    { key: "distanceFromRoad", value: null, source: "gis", confidence: null },
  ],
  statuses: ["inclined", "vegetation"],
  suggestedStatuses: ["inclined"],
  functional: "unknown",
  comment: "",
  poleIds: [],
  ...over,
});

describe("formatCapturedLine", () => {
  it("leads with the asset code when there is one", () => {
    expect(formatCapturedAt(at(9, 22))).toMatch(/^22 Sept? 2026, 10:14$/);
    expect(formatCapturedLine(record())).toMatch(
      /^EP-00412 · captured 22 Sept? 2026, 10:14$/,
    );
    expect(formatCapturedLine(record({ assetId: undefined }))).toMatch(
      /^Captured 22 Sept? 2026, 10:14$/,
    );
  });
});

describe("statusSource", () => {
  it("is the AI's only while its suggestion is kept as is", () => {
    expect(
      statusSource({ statuses: ["inclined"], suggestedStatuses: ["inclined"] }),
    ).toBe("ai");
    expect(statusSource(record())).toBe("user");
    expect(statusSource({ statuses: [], suggestedStatuses: [] })).toBe("user");
  });
});

describe("formatStatuses", () => {
  it("lists the statuses in one sentence", () => {
    expect(formatStatuses(["inclined", "vegetation"])).toBe(
      "Inclined, covered by vegetation",
    );
    expect(formatStatuses([])).toBeNull();
  });
});

describe("splitAttributes", () => {
  it("puts the GIS values after the Status row", () => {
    const { before, after } = splitAttributes(record().attributes);
    expect(before.map((a) => a.key)).toEqual([
      "material",
      "inclination",
      "vegetationCover",
    ]);
    expect(after.map((a) => a.key)).toEqual(["distanceFromRoad"]);
  });
});

describe("conditionSummary", () => {
  it("uses the measured values for inclination and cover", () => {
    expect(conditionSummary(record())).toBe("Inclined 7°, partial vegetation");
  });

  it("says when there is no vegetation, and falls back to status names", () => {
    const earlier = record({
      statuses: ["inclined"],
      attributes: [
        { key: "inclination", value: "4", source: "ai", confidence: "high" },
        {
          key: "vegetationCover",
          value: "none",
          source: "ai",
          confidence: "high",
        },
      ],
    });
    expect(conditionSummary(earlier)).toBe("Inclined 4°, no vegetation");
    expect(
      conditionSummary(
        record({ statuses: ["cracked", "inclined"], attributes: [] }),
      ),
    ).toBe("Cracked / damaged, inclined");
    expect(conditionSummary(record({ statuses: [], attributes: [] }))).toBe(
      "No condition recorded",
    );
  });
});

describe("recordHistory", () => {
  const now = record();
  const earlier = record({ id: "earlier", capturedAt: at(8, 12) });
  const other = record({ id: "other", assetId: "EP-00413" });

  it("lists the asset's captures newest first and marks this one", () => {
    const history = recordHistory({ now, earlier, other }, now);
    expect(history.map((h) => [h.id, h.current])).toEqual([
      ["now", true],
      ["earlier", false],
    ]);
    expect(history[0].title).toMatch(/^22 Sept? 2026 · this capture$/);
    expect(history[1].title).toMatch(/^12 Aug 2026$/);
    expect(history[0].summary).toBe("Inclined 7°, partial vegetation");
  });

  it("has only the record itself without an asset code", () => {
    const loose = record({ id: "loose", assetId: undefined });
    expect(recordHistory({ now, earlier }, loose).map((h) => h.id)).toEqual([
      "loose",
    ]);
  });
});

describe("photoCounter", () => {
  it("counts from one, and names a single photo", () => {
    expect(photoCounter(0, 2)).toBe("1 of 2 photos");
    expect(photoCounter(1, 2)).toBe("2 of 2 photos");
    expect(photoCounter(0, 1)).toBe("1 photo");
  });
});
