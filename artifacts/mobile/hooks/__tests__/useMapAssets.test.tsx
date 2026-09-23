import { fakeMapAssets } from "@/mocks/assets";
import { replaceAssets } from "@/services/storage/AssetStore";
import { act, renderHook } from "@testing-library/react-native";
import { useMapAssets } from "../useMapAssets";

const ASSETS = fakeMapAssets(new Date(2026, 8, 23, 12, 0));
const WATER = ASSETS.filter((a) => a.category === "water").length;

beforeEach(() => replaceAssets(ASSETS));

describe("useMapAssets", () => {
  it("shows every asset as GeoJSON to start with", async () => {
    const { result } = await renderHook(() => useMapAssets());
    expect(result.current.total).toBe(ASSETS.length);
    expect(result.current.visible).toHaveLength(ASSETS.length);
    expect(result.current.features.features).toHaveLength(ASSETS.length);
    expect(result.current.selected).toBeNull();
  });

  it("narrows the pins by category and search", async () => {
    const { result } = await renderHook(() => useMapAssets());
    await act(() => result.current.setCategory("water"));
    expect(result.current.features.features).toHaveLength(WATER);
    await act(() => result.current.setQuery("borehole"));
    expect(result.current.visible.map((a) => a.id)).toEqual(["WS-00128"]);
  });

  it("selects an asset and drops it when a filter hides it", async () => {
    const { result } = await renderHook(() => useMapAssets());
    await act(() => result.current.select("EP-00412"));
    expect(result.current.selected?.title).toBe("Concrete pole");
    await act(() => result.current.setCategory("roads"));
    expect(result.current.selected).toBeNull();
  });

  it("follows store updates", async () => {
    const { result } = await renderHook(() => useMapAssets());
    await act(() => replaceAssets(ASSETS.slice(0, 2)));
    expect(result.current.total).toBe(2);
  });
});
