import { geoTagsToGeoJSON } from "@/hooks/useGeoJsonHooks";
import { Camera, CircleLayer, MapView, ShapeSource, SymbolLayer } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useState } from "react";
import { useMMKVStorage } from "./MmkvContext";

export default function ImageGeoMap() {
  const [geojson, setGeojson] = useState<any>(null);
  const storage = useMMKVStorage();

  const refresh =()=> useCallback(() => {
    setGeojson(geoTagsToGeoJSON());
  },[]);

  useEffect(() => {
    refresh();
    // Listen for MMKV changes
    if(storage){
      const listener = storage.addOnValueChangedListener((key: string) => {
        if (key === "geotags") refresh();
      });
      return () => listener.remove();
    }
  }, [storage, refresh]);

  if (!geojson) return null;

  return (
    <MapView style={{ flex: 1 }}>
      <Camera
        zoomLevel={14}
        centerCoordinate={[
          geojson.features[0]?.geometry.coordinates[0],
          geojson.features[0]?.geometry.coordinates[1],
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
