import { fakeMapAssets } from "@/mocks/assets";
import {
  clearAssets,
  DEFAULT_MAP_PREFERENCES,
  mapAssets$,
  mapPreferences$,
  replaceAssets,
  setMapPreferences,
  upsertAsset,
} from "../AssetStore";

const [pole, borehole] = fakeMapAssets(new Date(2026, 8, 23, 12, 0));

beforeEach(() => {
  clearAssets();
  mapPreferences$.set({ ...DEFAULT_MAP_PREFERENCES });
});

describe("AssetStore", () => {
  it("adds assets and replaces one re-captured under the same id in place", () => {
    upsertAsset(pole);
    upsertAsset(borehole);
    upsertAsset({ ...pole, title: "Concrete pole · straightened" });
    expect(mapAssets$.get().map((a) => [a.id, a.title])).toEqual([
      [pole.id, "Concrete pole · straightened"],
      [borehole.id, borehole.title],
    ]);
  });

  it("replaces and clears the whole list", () => {
    replaceAssets([pole, borehole]);
    expect(mapAssets$.get()).toHaveLength(2);
    clearAssets();
    expect(mapAssets$.get()).toEqual([]);
  });

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
