import type { MapAsset } from "@/types/Map";
import {
  assetBounds,
  conditionChips,
  filterAssets,
  formatAssetMeta,
  formatDistance,
  formatLastSeen,
  toFeatureCollection,
} from "../mapAssets";

const NOW = new Date(2026, 8, 23, 12, 0);

const asset = (over: Partial<MapAsset> = {}): MapAsset => ({
  id: "EP-00412",
  category: "energy",
  label: "pole",
  title: "Concrete pole",
  latitude: 0.3476,
  longitude: 32.5825,
  accuracyM: 2.8,
  altitude: 1190,
  statuses: ["good"],
  functional: "unknown",
  attributes: [],
  firstRecordedAt: new Date(2026, 4, 2).getTime(),
  lastSeenAt: new Date(2026, 8, 23, 10, 14).getTime(),
  capturedBy: "Grace Nakato",
  photoCount: 2,
  syncStatus: "synced",
  flagged: false,
  comment: "",
  ...over,
});

const ASSETS = [
  asset(),
  asset({
    id: "WS-00128",
    category: "water",
    label: "borehole",
    title: "Borehole",
  }),
  asset({
    id: "TC-00057",
    category: "telecom",
    label: "mast",
    title: "Telecom mast",
  }),
];

describe("filterAssets", () => {
  it("keeps everything for 'all' and an empty search", () => {
    expect(filterAssets(ASSETS, "all", "  ")).toHaveLength(3);
  });

  it("filters by category", () => {
    expect(filterAssets(ASSETS, "water", "").map((a) => a.id)).toEqual([
      "WS-00128",
    ]);
  });

  it("matches the code, name or class, ignoring case", () => {
    expect(filterAssets(ASSETS, "all", "ep-004").map((a) => a.id)).toEqual([
      "EP-00412",
    ]);
    expect(filterAssets(ASSETS, "all", "BORE").map((a) => a.id)).toEqual([
      "WS-00128",
    ]);
    expect(filterAssets(ASSETS, "all", "mast").map((a) => a.id)).toEqual([
      "TC-00057",
    ]);
  });

  it("combines the category and the search", () => {
    expect(filterAssets(ASSETS, "energy", "borehole")).toEqual([]);
  });
});

describe("toFeatureCollection", () => {
  it("makes one [lng, lat] point per asset with its id and category", () => {
    expect(toFeatureCollection([ASSETS[0]])).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "EP-00412",
          properties: { id: "EP-00412", category: "energy" },
          geometry: { type: "Point", coordinates: [32.5825, 0.3476] },
        },
      ],
    });
  });
});

describe("assetBounds", () => {
  it("is null without assets", () => {
    expect(assetBounds([])).toBeNull();
  });

  it("wraps every asset as [west, south, east, north]", () => {
    expect(
      assetBounds([
        asset({ latitude: 1, longitude: 30 }),
        asset({ latitude: -1, longitude: 33 }),
      ]),
    ).toEqual([30, -1, 33, 1]);
  });
});

describe("formatting", () => {
  it("shows metres below a kilometre, then kilometres", () => {
    expect(formatDistance(37.6)).toBe("38 m");
    expect(formatDistance(1240)).toBe("1.2 km");
  });

  it("shows the time for today and the date otherwise", () => {
    expect(formatLastSeen(new Date(2026, 8, 23, 9, 5).getTime(), NOW)).toBe(
      "today 09:05",
    );
    expect(formatLastSeen(new Date(2026, 7, 12, 9, 5).getTime(), NOW)).toBe(
      "12 Aug 2026",
    );
  });

  it("adds the distance only when the device position is known", () => {
    const pole = asset();
    expect(formatAssetMeta(pole, null, NOW)).toBe(
      "EP-00412 · last seen today 10:14",
    );
    // ~38 m north of the pole.
    const from = { latitude: 0.3476 + 38 / 111_320, longitude: 32.5825 };
    expect(formatAssetMeta(pole, from, NOW)).toBe(
      "EP-00412 · last seen today 10:14 · 38 m away",
    );
  });
});

describe("conditionChips", () => {
  it("shows measured values for inclination and vegetation", () => {
    const pole = asset({
      statuses: ["inclined", "vegetation"],
      attributes: [
        { key: "inclination", value: "7", source: "ai", confidence: "high" },
        {
          key: "vegetationCover",
          value: "partial",
          source: "ai",
          confidence: "medium",
        },
      ],
    });
    expect(conditionChips(pole)).toEqual([
      { label: "Inclined 7°", tone: "warning" },
      { label: "Vegetation: partial", tone: "success" },
    ]);
  });

  it("warns about heavy vegetation", () => {
    const pole = asset({
      statuses: ["vegetation"],
      attributes: [
        {
          key: "vegetationCover",
          value: "heavy",
          source: "user",
          confidence: null,
        },
      ],
    });
    expect(conditionChips(pole)).toEqual([
      { label: "Vegetation: heavy", tone: "warning" },
    ]);
  });

  it("falls back to the status label and its tone", () => {
    expect(
      conditionChips(asset({ statuses: ["good", "inclined", "vandalised"] })),
    ).toEqual([
      { label: "Good condition", tone: "success" },
      { label: "Inclined", tone: "warning" },
      { label: "Vandalised", tone: "danger" },
    ]);
  });
});
