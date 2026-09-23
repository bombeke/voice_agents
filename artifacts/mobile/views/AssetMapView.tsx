import { AssetLayers } from "@/components/map/AssetLayers";
import { CategoryFilterChips } from "@/components/map/CategoryFilterChips";
import { MapControls } from "@/components/map/MapControls";
import { MapLayersSheet } from "@/components/map/MapLayersSheet";
import { OfflineTilesBadge } from "@/components/map/OfflineTilesBadge";
import { SelectedAssetCard } from "@/components/map/SelectedAssetCard";
import { InfoNote } from "@/components/ui/InfoNote";
import { SearchBar } from "@/components/ui/SearchBar";
import {
  BASEMAP_STYLES,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  LOCATE_ZOOM,
} from "@/constants/Map";
import { strings } from "@/constants/Strings";
import { assetBounds } from "@/helpers/mapAssets";
import { useLastKnownPosition } from "@/hooks/useLastKnownPosition";
import { useMapAssets } from "@/hooks/useMapAssets";
import { Routes } from "@/services/Routes";
import {
  mapAssets$,
  mapPreferences$,
  setMapPreferences,
} from "@/services/storage/AssetStore";
import { isOnline$ } from "@/services/storage/LegendState";
import { useSelector } from "@legendapp/state/react";
import {
  Camera,
  type CameraRef,
  type InitialViewState,
  Map,
  UserLocation,
} from "@maplibre/maplibre-react-native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { withUniwind } from "uniwind";

// Map only className → style: auto mode would treat `mapStyle` as a style prop.
const StyledMap = withUniwind(Map, { style: { fromClassName: "className" } });

/** Keeps pins clear of the search bar and chips when fitting them. */
const FIT_PADDING = { top: 190, right: 40, bottom: 60, left: 40 };

/** Frame every recorded asset on open; the default centre when there are none. */
function initialView(): InitialViewState {
  const bounds = assetBounds(mapAssets$.peek());
  if (!bounds) return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  const [west, south, east, north] = bounds;
  if (west === east && south === north) {
    return { center: [west, south], zoom: LOCATE_ZOOM };
  }
  return { bounds, padding: FIT_PADDING };
}

/**
 * Map tab: recorded assets as clustered pins coloured by category, with
 * search, category filters, basemap choice, and a card for the tapped pin
 * that opens into its asset profile. `focusId` (an asset code, e.g. from a
 * record's "Show on map") selects that pin and centres the map on it.
 */
export function AssetMapView({ focusId }: { focusId?: string } = {}) {
  const router = useRouter();
  const {
    total,
    visible,
    features,
    category,
    setCategory,
    query,
    setQuery,
    selected,
    select,
  } = useMapAssets();
  const { position, refresh } = useLastKnownPosition();
  const preferences = useSelector(mapPreferences$);
  const online = useSelector(isOnline$);

  const camera = useRef<CameraRef>(null);
  const [initialViewState] = useState(initialView);
  const [profileOpen, setProfileOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);

  const selectAsset = (id: string | null) => {
    setProfileOpen(false);
    select(id);
  };

  const locate = async () => {
    const at = position ?? (await refresh());
    if (!at) return;
    camera.current?.flyTo({
      center: [at.longitude, at.latitude],
      zoom: LOCATE_ZOOM,
      duration: 800,
    });
  };

  // Once per link: later store updates don't re-select or move the map.
  useEffect(() => {
    if (!focusId) return;
    const asset = mapAssets$.peek().find((a) => a.id === focusId);
    if (!asset) return;
    setCategory("all");
    setQuery("");
    setProfileOpen(false);
    select(asset.id);
    camera.current?.flyTo({
      center: [asset.longitude, asset.latitude],
      zoom: LOCATE_ZOOM,
      duration: 800,
    });
  }, [focusId, select, setCategory, setQuery]);

  const zoomTo = (center: [number, number], zoom: number) =>
    camera.current?.easeTo({ center, zoom, duration: 500 });

  return (
    <View className="flex-1 bg-background">
      <StyledMap
        className="flex-1"
        mapStyle={BASEMAP_STYLES[preferences.basemap]}
        onPress={() => selectAsset(null)}
        compass={false}
      >
        <Camera ref={camera} initialViewState={initialViewState} />
        <AssetLayers
          features={features}
          selectedId={selected?.id ?? null}
          cluster={preferences.cluster}
          onSelect={selectAsset}
          onZoomTo={zoomTo}
        />
        {position ? <UserLocation /> : null}
      </StyledMap>

      <View
        pointerEvents="box-none"
        className="absolute top-0 left-0 right-0 pt-safe-offset-3 px-4 gap-2.5"
      >
        <SearchBar
          value={query}
          onChangeText={setQuery}
          label={strings.map.searchLabel}
          placeholder={strings.map.searchPlaceholder}
          clearLabel={strings.map.clearSearch}
        />
        <CategoryFilterChips value={category} onChange={setCategory} />
        {online ? null : <OfflineTilesBadge />}
        {total > 0 && visible.length === 0 ? (
          <InfoNote>{strings.map.noMatches}</InfoNote>
        ) : null}
      </View>

      <View
        pointerEvents="box-none"
        className="absolute bottom-3 left-3 right-3 gap-3"
      >
        <View className="self-end">
          <MapControls
            onLayersPress={() => setLayersOpen(true)}
            onLocatePress={locate}
          />
        </View>
        {selected ? (
          <SelectedAssetCard
            asset={selected}
            position={position}
            profileOpen={profileOpen}
            onToggleProfile={() => setProfileOpen((open) => !open)}
            onRecapture={() =>
              router.push({
                pathname: Routes.CAPTURE,
                params: { category: selected.category },
              })
            }
            onViewRecord={() =>
              router.push({
                pathname: Routes.RECORD_DETAIL,
                params: { id: selected.id },
              })
            }
            onClose={() => selectAsset(null)}
          />
        ) : null}
      </View>

      <MapLayersSheet
        visible={layersOpen}
        preferences={preferences}
        onChange={setMapPreferences}
        onClose={() => setLayersOpen(false)}
      />
    </View>
  );
}
