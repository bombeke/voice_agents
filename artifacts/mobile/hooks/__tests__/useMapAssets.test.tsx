import { mapAssets } from "@/db/schema";
import { setupTestDatabase } from "@/db/testing/TestDb";
import { fakeMapAssets } from "@/mocks/assets";
import { upsertAssets } from "@/services/storage/repos/MapAssetRepo";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { inArray } from "drizzle-orm";
import { useMapAssets } from "../useMapAssets";

const ASSETS = fakeMapAssets(new Date(2026, 8, 23, 12, 0));
const WATER = ASSETS.filter((a) => a.category === "water").length;
const getDb = setupTestDatabase();

beforeEach(() => getDb().write((tx) => upsertAssets(tx, ASSETS)));

async function render() {
  const hook = await renderHook(() => useMapAssets());
  await waitFor(() => expect(hook.result.current.total).toBe(ASSETS.length));
  return hook;
}

describe("useMapAssets", () => {
  it("shows every asset as GeoJSON before the map reports its viewport", async () => {
    const { result } = await render();
    expect(result.current.visible).toHaveLength(ASSETS.length);
    expect(result.current.features.features).toHaveLength(ASSETS.length);
    expect(result.current.selected).toBeNull();
  });

  it("narrows the pins by category and search", async () => {
    const { result } = await render();
    await act(() => result.current.setCategory("water"));
    await waitFor(() =>
      expect(result.current.features.features).toHaveLength(WATER),
    );
    await act(() => result.current.setQuery("borehole"));
    await waitFor(() =>
      expect(result.current.visible.map((a) => a.id)).toEqual(["WS-00128"]),
    );
  });

  it("reads only the viewport once the map reports it", async () => {
    const { result } = await render();
    const pole = ASSETS.find((a) => a.id === "EP-00412")!;
    await act(() =>
      result.current.setBounds([
        pole.longitude - 1e-6,
        pole.latitude - 1e-6,
        pole.longitude + 1e-6,
        pole.latitude + 1e-6,
      ]),
    );
    await waitFor(() =>
      expect(result.current.visible.map((a) => a.id)).toEqual(["EP-00412"]),
    );
    expect(result.current.total).toBe(ASSETS.length);
  });

  it("selects an asset and drops it when a filter hides it", async () => {
    const { result } = await render();
    await act(() => result.current.select("EP-00412"));
    expect(result.current.selected?.title).toBe("Concrete pole");
    await act(() => result.current.setCategory("roads"));
    await waitFor(() => expect(result.current.selected).toBeNull());
  });

  it("follows the database", async () => {
    const { result } = await render();
    await act(() =>
      getDb().write((tx) =>
        tx.delete(mapAssets).where(
          inArray(
            mapAssets.id,
            ASSETS.slice(2).map((a) => a.id),
          ),
        ),
      ),
    );
    await waitFor(() => expect(result.current.total).toBe(2));
  });
});
