import { filterAssets, toFeatureCollection } from "@/helpers/mapAssets";
import { mapAssets$ } from "@/services/storage/AssetStore";
import type { MapCategoryFilter } from "@/types/Map";
import { useSelector } from "@legendapp/state/react";
import { useMemo, useState } from "react";

/**
 * The Map tab's state: the category chip, the search text, the filtered
 * assets as GeoJSON, and the selected asset. A selection hidden by a new
 * filter is dropped so the card never describes an invisible pin.
 */
export function useMapAssets() {
  const assets = useSelector(mapAssets$);
  const [category, setCategory] = useState<MapCategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(
    () => filterAssets(assets, category, query),
    [assets, category, query],
  );
  const features = useMemo(() => toFeatureCollection(visible), [visible]);
  const selected = useMemo(
    () => visible.find((a) => a.id === selectedId) ?? null,
    [visible, selectedId],
  );

  return {
    total: assets.length,
    visible,
    features,
    category,
    setCategory,
    query,
    setQuery,
    selected,
    select: setSelectedId,
  };
}
