import { setupTestDatabase } from "@/db/testing/TestDb";
import { fakeMapAssets } from "@/mocks/assets";
import {
  DEFAULT_MAP_PREFERENCES,
  mapPreferences$,
  setMapPreferences,
} from "../AssetStore";
import {
  assetCount,
  assetExtent,
  assetsInView,
  getAsset,
  upsertAssets,
} from "../repos/MapAssetRepo";

const assets = fakeMapAssets(new Date(2026, 8, 23, 12, 0));
const [pole, borehole] = assets;

const getDb = setupTestDatabase();
const orm = () => getDb().orm;

beforeEach(() => mapPreferences$.set({ ...DEFAULT_MAP_PREFERENCES }));

describe("map assets (MapAssetRepo)", () => {
  it("adds assets and replaces one re-captured under the same id", async () => {
    await getDb().write((tx) => upsertAssets(tx, [pole, borehole]));
    await getDb().write((tx) =>
      upsertAssets(tx, [{ ...pole, title: "Concrete pole · straightened" }]),
    );
    expect(await assetCount(orm())).toBe(2);
    expect((await getAsset(orm(), pole.id))?.title).toBe(
      "Concrete pole · straightened",
    );
  });

  it("reads only the assets inside the viewport", async () => {
    await getDb().write((tx) => upsertAssets(tx, assets));
    const box: [number, number, number, number] = [
      pole.longitude - 1e-6,
      pole.latitude - 1e-6,
      pole.longitude + 1e-6,
      pole.latitude + 1e-6,
    ];
    const inView = await assetsInView(orm(), {
      category: "all",
      query: "",
      bounds: box,
    });
    expect(inView.map((a) => a.id)).toEqual([pole.id]);
  });

  it("filters by category and by code, name or class", async () => {
    await getDb().write((tx) => upsertAssets(tx, assets));
    const water = await assetsInView(orm(), {
      category: "water",
      query: "",
      bounds: null,
    });
    expect(water.length).toBeGreaterThan(0);
    expect(water.every((a) => a.category === "water")).toBe(true);
    const byCode = await assetsInView(orm(), {
      category: "all",
      query: pole.id.toLowerCase(),
      bounds: null,
    });
    expect(byCode.map((a) => a.id)).toEqual([pole.id]);
    // LIKE wildcards in the search are literal.
    expect(
      await assetsInView(orm(), { category: "all", query: "%", bounds: null }),
    ).toEqual([]);
  });

  it("gives the extent around every asset, or null when there are none", async () => {
    expect(await assetExtent(orm())).toBeNull();
    await getDb().write((tx) => upsertAssets(tx, [pole, borehole]));
    expect(await assetExtent(orm())).toEqual([
      Math.min(pole.longitude, borehole.longitude),
      Math.min(pole.latitude, borehole.latitude),
      Math.max(pole.longitude, borehole.longitude),
      Math.max(pole.latitude, borehole.latitude),
    ]);
  });
});

describe("map preferences", () => {
  it("starts on clustered streets and merges preference changes", () => {
    expect(mapPreferences$.get()).toEqual({
      basemap: "streets",
      cluster: true,
    });
    setMapPreferences({ basemap: "satellite" });
    setMapPreferences({ cluster: false });
    expect(mapPreferences$.get()).toEqual({
      basemap: "satellite",
      cluster: false,
    });
  });
});
