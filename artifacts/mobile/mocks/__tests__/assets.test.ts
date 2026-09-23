import { DEFAULT_CENTER } from "@/constants/Map";
import { distanceM } from "@/helpers/duplicateCheck";
import { fakeMapAssets } from "../assets";

const NOW = new Date(2026, 8, 23, 12, 0);

describe("fakeMapAssets", () => {
  const assets = fakeMapAssets(NOW);

  it("covers every category with unique asset codes", () => {
    expect(new Set(assets.map((a) => a.category))).toEqual(
      new Set(["energy", "water", "telecom", "roads"]),
    );
    expect(new Set(assets.map((a) => a.id)).size).toBe(assets.length);
  });

  it("includes the mockup's inclined concrete pole at the map centre", () => {
    const pole = assets.find((a) => a.id === "EP-00412")!;
    expect(pole).toMatchObject({
      title: "Concrete pole",
      statuses: ["inclined", "vegetation"],
      syncStatus: "pending",
      latitude: DEFAULT_CENTER[1],
      longitude: DEFAULT_CENTER[0],
    });
    expect(pole.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "inclination", value: "7" }),
        expect.objectContaining({ key: "vegetationCover", value: "partial" }),
        expect.objectContaining({ key: "distanceFromRoad", source: "gis" }),
      ]),
    );
  });

  it("places every asset within 3 km of the centre, seen before now", () => {
    const centre = {
      latitude: DEFAULT_CENTER[1],
      longitude: DEFAULT_CENTER[0],
    };
    for (const a of assets) {
      expect(distanceM(centre, a)).toBeLessThan(3000);
      expect(a.lastSeenAt).toBeLessThanOrEqual(NOW.getTime());
      expect(a.firstRecordedAt).toBeLessThan(a.lastSeenAt);
    }
  });

  it("has a tight group of poles for clustering", () => {
    const feeder = assets.filter((a) => a.id.startsWith("EP-003"));
    expect(feeder).toHaveLength(12);
    for (const a of feeder) expect(distanceM(feeder[0], a)).toBeLessThan(250);
  });
});
