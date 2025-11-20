import { MapView } from "@maplibre/maplibre-react-native";

export default function DashboardMaps() {
  return (
    <MapView 
      style={{ flex: 1 }}
      mapStyle={`https://tiles.openfreemap.org/styles/liberty`}
    />
  );
}