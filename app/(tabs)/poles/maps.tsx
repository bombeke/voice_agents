import { usePhotoGeoJSON } from "@/hooks/useGeoJsonHooks";
import { Camera, CameraRef, CircleLayer, MapView, ShapeSource, SymbolLayer } from "@maplibre/maplibre-react-native";
import { Accuracy, getCurrentPositionAsync } from "expo-location";
import { useEffect, useMemo, useRef } from "react";

export default function DashboardMaps() {
    const geojson: any = usePhotoGeoJSON();
    console.log("GEO:",geojson);
    const memoGeoJSON = useMemo(() => geojson, [geojson]);
    const cameraRef = useRef<CameraRef>(null);

    // Fallback center if geojson is empty
    const firstFeature = memoGeoJSON?.features?.[0];
    const lng = firstFeature?.geometry?.coordinates?.[0];
    const lat = firstFeature?.geometry?.coordinates?.[1];
    const initialCenter = useRef<[number, number]>([
      lng,
      lat
    ]);
    

  // Update camera only when geojson first loads
  useEffect(() => {
    const initMap = async()=>{
        const locationResult = await getCurrentPositionAsync({
          accuracy: Accuracy.High,
        });
        if (firstFeature && cameraRef.current) {
          initialCenter.current = [locationResult.coords.longitude ?? lng, locationResult.coords.latitude ?? lat]
          cameraRef.current.setCamera({
            centerCoordinate: initialCenter.current,
            zoomLevel: 8,
            animationDuration: 800,
          });
        }
      }
      initMap();
  }, [firstFeature, lng, lat]);

  return (
    <MapView
      style={{ flex: 1 }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
    >
      <Camera zoomLevel={8} ref={cameraRef} />

      {memoGeoJSON && memoGeoJSON.features && (
        <ShapeSource id="photos" shape={memoGeoJSON}>
          <CircleLayer
            id="photoPoints"
            style={{
              circleRadius: 6,
              circleColor: "rgba(177, 99, 54, 0.9)",
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
