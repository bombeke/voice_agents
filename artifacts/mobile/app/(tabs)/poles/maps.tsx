import { usePhotoGeoJSON } from "@/hooks/useGeoJsonHooks";
import {
  Camera,
  CameraRef,
  CircleLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
} from "@maplibre/maplibre-react-native";
import {
  Accuracy,
  getCurrentPositionAsync,
  requestForegroundPermissionsAsync,
} from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";

const DEFAULT_CENTER: [number, number] = [29.2297, -1.6712];

export default function DashboardMaps() {
  const geojson = usePhotoGeoJSON();
  const memoGeoJSON = useMemo(() => geojson, [geojson]);
  const cameraRef = useRef<CameraRef>(null);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(8);

  useEffect(() => {
    if (Platform.OS === "web") return;

    let cancelled = false;

    const initMap = async () => {
      const { status } = await requestForegroundPermissionsAsync();
      if (cancelled || status !== "granted") return;

      const loc = await getCurrentPositionAsync({ accuracy: Accuracy.Balanced });
      if (cancelled) return;

      const coords: [number, number] = [
        loc.coords.longitude,
        loc.coords.latitude,
      ];
      setCenter(coords);
      setZoom(13);

      cameraRef.current?.setCamera({
        centerCoordinate: coords,
        zoomLevel: 13,
        animationDuration: 800,
      });
    };

    initMap();
    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS === "web") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#EFF6FF",
        }}
      >
        <Text style={{ color: "#64748B", fontSize: 15 }}>
          Map is only available on mobile devices.
        </Text>
      </View>
    );
  }

  const hasFeatures =
    Array.isArray(memoGeoJSON?.features) && memoGeoJSON.features.length > 0;

  return (
    <MapView
      style={{ flex: 1 }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
    >
      <Camera
        ref={cameraRef}
        zoomLevel={zoom}
        centerCoordinate={center}
        animationMode="flyTo"
        animationDuration={800}
      />

      {hasFeatures && (
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
            id="photoLabels"
            style={{
              textField: ["get", "id"],
              textSize: 10,
              textColor: "#111",
              textAnchor: "top",
              textOffset: [0, 1],
            }}
          />
        </ShapeSource>
      )}
    </MapView>
  );
}
