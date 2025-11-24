import { usePhotoGeoJSON } from "@/hooks/useGeoJsonHooks";
import { Camera, CircleLayer, MapView, ShapeSource, SymbolLayer } from "@maplibre/maplibre-react-native";

export default function DashboardMaps() {
  const geojson: any = usePhotoGeoJSON('photos');
  return (
    <MapView 
      style={{ flex: 1 }}
      mapStyle={`https://tiles.openfreemap.org/styles/liberty`}
    >
            <Camera
              zoomLevel={14}
              centerCoordinate={[
                geojson.features[0]?.geometry?.coordinates?.[0] || 0,
                geojson.features[0]?.geometry?.coordinates?.[1] || 0,
              ]}
            />
      
            <ShapeSource id="photos" shape={geojson}>
              {/* Point markers */}
              <CircleLayer
                id="photoPoints"
                style={{
                  circleRadius: 6,
                  circleColor: "rgba(0,122,255,0.9)",
                  circleStrokeWidth: 2,
                  circleStrokeColor: "#ffffff",
                }}
              />
      
              {/* Optional: show thumbnail */}
              <SymbolLayer
                id="photoIcons"
                style={{
                  textField: ["get", "created"],
                  textSize: 10,
                  textColor: "#000",
                  iconSize: 0.0001, // use if you add an icon
                }}
              />
              </ShapeSource>
  </MapView>
  );
}