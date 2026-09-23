import { AssetMapView } from "@/views/AssetMapView";
import { useLocalSearchParams } from "expo-router";

/** Takes `?id=` (asset code) to select and centre that pin. */
export default function MapScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <AssetMapView focusId={id} />;
}
