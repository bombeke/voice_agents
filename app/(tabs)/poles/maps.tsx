import { usePhotoGeoJSON } from "@/hooks/useGeoJsonHooks";
import { Camera, CameraRef, CircleLayer, MapView, ShapeSource, SymbolLayer } from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useRef } from "react";

export default function DashboardMaps() {
    const geojson: any = usePhotoGeoJSON("photos");
    console.log("GEO:",geojson);
    const memoGeoJSON = useMemo(() => geojson, [geojson?.features]);
    const cameraRef = useRef<CameraRef>(null);

    // Fallback center if geojson is empty
    const firstFeature = geojson?.features?.[0];
    const lng = firstFeature?.geometry?.coordinates?.[0] ?? 32.5825;
    const lat = firstFeature?.geometry?.coordinates?.[1] ?? 0.3476;
    const initialCenter = useRef<[number, number]>([
      lng,
      lat
    ]);
    

  // Update camera only when geojson first loads
  useEffect(() => {
    if (firstFeature && cameraRef.current) {
      initialCenter.current = [lng, lat]
      cameraRef.current.setCamera({
        centerCoordinate: initialCenter.current,
        zoomLevel: 4,
        animationDuration: 800,
      });
    }
  }, [memoGeoJSON?.features]);

  return (
    <MapView
      style={{ flex: 1 }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
    >
      <Camera zoomLevel={4} ref={cameraRef} />

      {memoGeoJSON && memoGeoJSON.features && (
        <ShapeSource id="photos" shape={memoGeoJSON}>
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
