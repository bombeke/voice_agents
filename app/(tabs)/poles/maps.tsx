import { CircleLayer, MapView, ShapeSource, SymbolLayer } from "@maplibre/maplibre-react-native";

export default function DashboardMaps() {
  return (
    <MapView 
      style={{ flex: 1 }}
      mapStyle={`https://tiles.openfreemap.org/styles/liberty`}
    >
      
  <ShapeSource
    id="photos"
    shape={geojson}
    cluster={true}
    clusterRadius={50}
  >
    <CircleLayer
      id="photo-points"
      sourceID="photos"
      paint={{
        "circle-radius": 6,
        "circle-color": "#FF6600"
      }}
    />

    <SymbolLayer
      id="clusters"
      filter={['has', 'point_count']}
      paint={{
        'text-color': '#000'
      }}
      layout={{
        'text-field': '{point_count_abbreviated}',
        'text-size': 14
      }}
    />
  </ShapeSource>
  </MapView>
  );
}