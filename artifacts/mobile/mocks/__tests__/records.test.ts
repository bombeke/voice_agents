import { fakeMapAssets } from "../assets";
import { fakeCaptures } from "../captures";
import { fakeRecords } from "../records";

// mocks/captures reads the network flag; the real module opens sync timers.
jest.mock("@/services/storage/LegendState", () => ({
  isOnline$: require("@legendapp/state").observable(true),
}));

const NOW = new Date(2026, 8, 22, 10, 14);
const CAPTURES = fakeCaptures(NOW);
const RECORDS = fakeRecords(CAPTURES, fakeMapAssets(NOW));

describe("fakeRecords", () => {
  it("has a full record for every fake capture, plus EP-00412's history", () => {
    const ids = new Set(RECORDS.map((r) => r.id));
    for (const c of CAPTURES) expect(ids.has(c.id)).toBe(true);
    expect(RECORDS.filter((r) => r.assetId === "EP-00412")).toHaveLength(2);
  });

  it("shows the mockup's pole", () => {
    const pole = RECORDS.find((r) => r.id === "fake-capture-1")!;
    expect(pole).toMatchObject({
      title: "Concrete pole",
      assetId: "EP-00412",
      statuses: ["inclined", "vegetation"],
      comment: "Leaning toward the road after heavy rain.",
      location: { accuracy: 2.8, altitude: 1203.4 },
    });
    expect(pole.photos).toHaveLength(2);
    // "2 detections" made two queued records.
    expect(pole.poleIds).toHaveLength(2);
  });

  it("puts records at their Map pins, and loose ones nearby", () => {
    const assets = fakeMapAssets(NOW);
    const pole = RECORDS.find((r) => r.id === "fake-capture-1")!;
    const pin = assets.find((a) => a.id === "EP-00412")!;
    expect(pole.location).toMatchObject({
      latitude: pin.latitude,
      longitude: pin.longitude,
    });
    const toilet = RECORDS.find((r) => r.title === "Toilet block")!;
    expect(toilet.assetId).toBeUndefined();
    expect(toilet.location.latitude).not.toBe(assets[0].latitude);
  });
});
