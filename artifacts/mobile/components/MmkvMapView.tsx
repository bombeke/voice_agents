import { geoTagsToGeoJSON } from "@/hooks/useGeoJsonHooks";
import { colors } from "@/constants/theme";
import {
  Camera,
  CircleLayer,
  MapView as RNMapView,
  ShapeSource,
  SymbolLayer,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useState } from "react";
import { withUniwind } from "uniwind";
import { useMMKVStorage } from "./MmkvContext";

const MapView = withUniwind(RNMapView);

export default function ImageGeoMap() {
  const [geojson, setGeojson] = useState<any>(null);
  const storage = useMMKVStorage();

  const refresh = () =>
    useCallback(() => {
      setGeojson(geoTagsToGeoJSON());
    }, []);

  useEffect(() => {
    refresh();
    // Listen for MMKV changes
    if (storage) {
      const listener = storage.addOnValueChangedListener((key: string) => {
        if (key === "geotags") refresh();
      });
      return () => listener.remove();
    }
  }, [storage, refresh]);

  if (!geojson) return null;

  return (
    <MapView className="flex-1">
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
            circleColor: colors.primary,
            circleStrokeWidth: 2,
            circleStrokeColor: colors.surface,
          }}
        />

        {/* Optional: show thumbnail */}
        <SymbolLayer
          id="photoIcons"
          style={{
            textField: ["get", "created"],
            textSize: 10,
            textColor: colors.text,
            iconSize: 0.0001, // use if you add an icon
          }}
        />
      </ShapeSource>
    </MapView>
  );
}
