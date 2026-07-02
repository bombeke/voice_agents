import { usePhotoGeoJSON } from "@/hooks/useGeoJsonHooks";
import {
  Camera,
  CameraRef,
  Layer,
  Map,
  GeoJSONSource,
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

      cameraRef.current?.setStop({
        center: coords,
        zoom: 13,
        duration: 800,
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
    <Map
      style={{ flex: 1 }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
    >
      <Camera
        ref={cameraRef}
        zoom={zoom}
        center={center}
        easing="fly"
        duration={800}
      />

      {hasFeatures && (
        <GeoJSONSource id="photos" data={memoGeoJSON}>
          <Layer
            id="photoPoints"
            type="circle"
            paint={{
              "circle-radius": 6,
              "circle-color": "rgba(177, 99, 54, 0.9)",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            }}
          />
          <Layer
            id="photoLabels"
            type="symbol"
            layout={{
              "text-field": ["get", "id"],
              "text-size": 10,
              "text-color": "#111",
              "text-anchor": "top",
              "text-offset": [0, 1],
            }}
          />
        </GeoJSONSource>
      )}
    </Map>
  );
}
