import { usePhotoGeoJSON } from "@/hooks/useGeoJsonHooks";
import { Camera, CircleLayer, MapView, ShapeSource, SymbolLayer } from "@maplibre/maplibre-react-native";

export default function DashboardMaps() {
  const geojson: any = usePhotoGeoJSON("photos");

  // Fallback center if geojson is empty
  const firstFeature = geojson?.features?.[0];
  const lng = firstFeature?.geometry?.coordinates?.[0] ?? 32.5825;
  const lat = firstFeature?.geometry?.coordinates?.[1] ?? 0.3476;

  return (
    <MapView
      style={{ flex: 1 }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty" // FIXED
    >
      <Camera zoomLevel={4} centerCoordinate={[lng, lat]} />

      {geojson && geojson.features && (
        <ShapeSource id="photos" shape={geojson}>
          <CircleLayer
            id="photoPoints"
            style={{
              circleRadius: 6,
              circleColor: "rgba(0,122,255,0.9)",
              circleStrokeWidth: 2,
              circleStrokeColor: "#fff",
            }}
          />

          <SymbolLayer
            id="photoIcons"
            style={{
              textField: ["get", "created"],
              textSize: 10,
              textColor: "#000",
              textAnchor: "top",
            }}
          />
        </ShapeSource>
      )}
    </MapView>
  );
}
