import { useLiveQuery } from "@/db/LiveQuery";
import { TABLES } from "@/db/schema";
import { toFeatureCollection } from "@/helpers/mapAssets";
import {
  assetCount,
  assetsInView,
  type Bounds,
} from "@/services/storage/repos/MapAssetRepo";
import type { MapAsset, MapCategoryFilter } from "@/types/Map";
import { useMemo, useState } from "react";

const TABLES_READ = [TABLES.mapAssets] as const;
const EMPTY = { total: 0, visible: [] as MapAsset[] };

/**
 * The Map tab's state: the category chip, the search text, the viewport, the
 * matching assets in view as GeoJSON, and the selected asset. Assets come
 * from an indexed bounding-box query, so only what the map can show is in
 * memory. A selection hidden by a new filter is dropped so the card never
 * describes an invisible pin.
 */
export function useMapAssets() {
  const [category, setCategory] = useState<MapCategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { total, visible } = useLiveQuery(
    TABLES_READ,
    async (orm) => {
      const [total, visible] = await Promise.all([
        assetCount(orm),
        assetsInView(orm, { category, query, bounds }),
      ]);
      return { total, visible };
    },
    [category, query, bounds?.join(",")],
    EMPTY,
    "map",
  );

  const features = useMemo(() => toFeatureCollection(visible), [visible]);
  const selected = useMemo(
    () => visible.find((a) => a.id === selectedId) ?? null,
    [visible, selectedId],
  );

  return {
    total,
    visible,
    features,
    category,
    setCategory,
    query,
    setQuery,
    setBounds,
    selected,
    select: setSelectedId,
  };
}
