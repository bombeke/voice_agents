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
import { peekDb } from "@/db/Current";
import { useLastKnownPosition } from "@/hooks/useLastKnownPosition";
import { useMapAssets } from "@/hooks/useMapAssets";
import { Routes } from "@/services/Routes";
import {
  mapPreferences$,
  setMapPreferences,
} from "@/services/storage/AssetStore";
import { isOnline$ } from "@/services/storage/NetworkState";
import { assetExtent, getAsset } from "@/services/storage/repos/MapAssetRepo";
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

const DEFAULT_VIEW: InitialViewState = {
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
};

type Focus = { id: string; latitude: number; longitude: number };

/**
 * Where the map opens: on the linked asset, else framing every recorded
 * asset (an indexed min/max, not a scan), else the default centre. Read
 * before the map mounts so the camera starts there: no camera command is
 * sent while the native map is still loading.
 */
async function openingView(
  focusId: string | undefined,
): Promise<{ view: InitialViewState; focus: Focus | null }> {
  const db = peekDb();
  if (!db) return { view: DEFAULT_VIEW, focus: null };
  if (focusId) {
    const asset = await getAsset(db.orm, focusId);
    if (asset) {
      return {
        view: { center: [asset.longitude, asset.latitude], zoom: LOCATE_ZOOM },
        focus: asset,
      };
    }
  }
  const extent = await assetExtent(db.orm);
  if (!extent) return { view: DEFAULT_VIEW, focus: null };
  const [west, south, east, north] = extent;
  if (west === east && south === north) {
    return { view: { center: [west, south], zoom: LOCATE_ZOOM }, focus: null };
  }
  return { view: { bounds: extent, padding: FIT_PADDING }, focus: null };
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
    setBounds,
    selected,
    select,
  } = useMapAssets();
  const { position, refresh } = useLastKnownPosition();
  const preferences = useSelector(mapPreferences$);
  const online = useSelector(isOnline$);

  const camera = useRef<CameraRef>(null);
  const [initialViewState, setInitialViewState] =
    useState<InitialViewState | null>(null);
  // Camera commands wait for the native map: before it has loaded, the
  // camera's view doesn't exist yet and the command is rejected.
  const mapReady = useRef(false);
  const pendingFocus = useRef<Focus | null>(null);
  const openedOn = useRef<string | undefined>(undefined);
  const [profileOpen, setProfileOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);

  const selectAsset = (id: string | null) => {
    setProfileOpen(false);
    select(id);
  };

  const locate = async () => {
    const at = position ?? (await refresh());
    if (!at || !mapReady.current) return;
    camera.current?.flyTo({
      center: [at.longitude, at.latitude],
      zoom: LOCATE_ZOOM,
      duration: 800,
    });
  };

  const flyToFocus = (focus: Focus) =>
    camera.current?.flyTo({
      center: [focus.longitude, focus.latitude],
      zoom: LOCATE_ZOOM,
      duration: 800,
    });

  const showFocus = (focus: Focus) => {
    setCategory("all");
    setQuery("");
    setProfileOpen(false);
    select(focus.id);
  };

  // Once, before the map mounts: where it opens (and the linked pin, selected).
  useEffect(() => {
    let cancelled = false;
    openingView(focusId).then(({ view, focus }) => {
      if (cancelled) return;
      openedOn.current = focusId;
      if (focus) showFocus(focus);
      setInitialViewState(view);
    });
    return () => {
      cancelled = true;
    };
    // The opening view is decided once; later links fly there (below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A later link (the map already open): select the pin and fly to it. Once
  // per link: later store updates don't re-select or move the map.
  useEffect(() => {
    const db = peekDb();
    if (!focusId || !db || !initialViewState || focusId === openedOn.current) {
      return;
    }
    openedOn.current = focusId;
    let cancelled = false;
    getAsset(db.orm, focusId).then((asset) => {
      if (cancelled || !asset) return;
      showFocus(asset);
      if (mapReady.current) flyToFocus(asset);
      else pendingFocus.current = asset;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, initialViewState]);

  const zoomTo = (center: [number, number], zoom: number) => {
    if (mapReady.current)
      camera.current?.easeTo({ center, zoom, duration: 500 });
  };

  // A few ms reading where to open; the map mounts already there.
  if (!initialViewState) return <View className="flex-1 bg-background" />;

  return (
    <View className="flex-1 bg-background">
      <StyledMap
        className="flex-1"
        mapStyle={BASEMAP_STYLES[preferences.basemap]}
        onPress={(event) => {
          // A pin or cluster press bubbles up here too, carrying its features;
          // only a press on the bare map clears the selection.
          if ("features" in event.nativeEvent) return;
          selectAsset(null);
        }}
        compass={false}
        // Only the assets in view are read from the database.
        onRegionDidChange={(event) => setBounds(event.nativeEvent.bounds)}
        onDidFinishLoadingMap={() => {
          mapReady.current = true;
          const focus = pendingFocus.current;
          pendingFocus.current = null;
          if (focus) flyToFocus(focus);
        }}
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
