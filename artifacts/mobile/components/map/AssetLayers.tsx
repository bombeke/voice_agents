import { CategoryColors, colors } from "@/constants/theme";
import { CLUSTER_MAX_ZOOM, CLUSTER_RADIUS } from "@/constants/Map";
import type { AssetFeatureCollection } from "@/helpers/mapAssets";
import {
  type CircleLayerSpecification,
  type FilterSpecification,
  GeoJSONSource,
  type GeoJSONSourceRef,
  Layer,
  type PressEventWithFeatures,
} from "@maplibre/maplibre-react-native";
import { useRef } from "react";
import type { NativeSyntheticEvent } from "react-native";

type CirclePaint = NonNullable<CircleLayerSpecification["paint"]>;
type Expression = Extract<CirclePaint["circle-radius"], unknown[]>;

/** Pin fill by category; clusters use the primary green. */
const CATEGORY_COLOR: CirclePaint["circle-color"] = [
  "match",
  ["get", "category"],
  "energy",
  CategoryColors.energy.solid,
  "water",
  CategoryColors.water.solid,
  "telecom",
  CategoryColors.telecom.solid,
  "roads",
  CategoryColors.roads.solid,
  colors.primary,
];

const IS_CLUSTER: FilterSpecification = ["has", "point_count"];
const IS_PIN: Expression = ["!", ["has", "point_count"]];

interface AssetLayersProps {
  features: AssetFeatureCollection;
  selectedId: string | null;
  cluster: boolean;
  onSelect: (id: string) => void;
  /** A cluster was tapped: zoom in far enough to split it. */
  onZoomTo: (center: [number, number], zoom: number) => void;
}

/**
 * Asset pins coloured by category, numbered clusters, and a ring around the
 * selected pin. The source stays mounted so filtering only swaps its data.
 */
export function AssetLayers({
  features,
  selectedId,
  cluster,
  onSelect,
  onZoomTo,
}: AssetLayersProps) {
  const source = useRef<GeoJSONSourceRef>(null);
  const isSelected: Expression = ["==", ["get", "id"], selectedId ?? ""];

  const onPress = async (
    event: NativeSyntheticEvent<PressEventWithFeatures>,
  ) => {
    // Keep the Map's own onPress (which clears the selection) out of it.
    event.stopPropagation();
    const feature = event.nativeEvent.features[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const props = feature.properties ?? {};
    if (props.cluster) {
      const zoom = await source.current?.getClusterExpansionZoom(
        props.cluster_id,
      );
      if (zoom !== undefined) {
        onZoomTo(feature.geometry.coordinates as [number, number], zoom);
      }
      return;
    }
    if (typeof props.id === "string") onSelect(props.id);
  };

  return (
    <GeoJSONSource
      // Clustering is fixed when a source is created, so toggling remounts it.
      key={cluster ? "clustered" : "pins"}
      id="assets"
      ref={source}
      data={features}
      cluster={cluster}
      clusterRadius={CLUSTER_RADIUS}
      clusterMaxZoom={CLUSTER_MAX_ZOOM}
      onPress={onPress}
    >
      <Layer
        id="asset-clusters"
        type="circle"
        filter={IS_CLUSTER}
        paint={{
          "circle-color": colors.primary,
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 20, 50, 24],
          "circle-stroke-width": 3,
          "circle-stroke-color": colors.surface,
        }}
      />
      <Layer
        id="asset-cluster-count"
        type="symbol"
        filter={IS_CLUSTER}
        layout={{
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 15,
          "text-allow-overlap": true,
        }}
        paint={{ "text-color": colors.onPrimary }}
      />
      <Layer
        id="asset-pins"
        type="circle"
        filter={IS_PIN}
        paint={{
          "circle-color": CATEGORY_COLOR,
          "circle-radius": ["case", isSelected, 11, 9],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": colors.surface,
        }}
      />
      <Layer
        id="asset-selected-ring"
        type="circle"
        filter={["all", IS_PIN, isSelected]}
        paint={{
          "circle-radius": 22,
          "circle-opacity": 0,
          "circle-stroke-width": 3,
          "circle-stroke-color": CATEGORY_COLOR,
        }}
      />
    </GeoJSONSource>
  );
}
