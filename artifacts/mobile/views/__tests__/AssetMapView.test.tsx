import { BASEMAP_STYLES } from "@/constants/Map";
import { fakeMapAssets } from "@/mocks/assets";
import {
  DEFAULT_MAP_PREFERENCES,
  mapPreferences$,
  replaceAssets,
} from "@/services/storage/AssetStore";
import { isOnline$ } from "@/services/storage/LegendState";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { AssetMapView } from "../AssetMapView";

const mockRouter = { push: jest.fn(), navigate: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

/** What the fake MapLibre components last received, and their imperative APIs. */
const mockMap = {
  style: undefined as unknown,
  cluster: undefined as boolean | undefined,
  features: [] as { properties: { id: string; category: string } }[],
  camera: { flyTo: jest.fn(), easeTo: jest.fn() },
  source: { getClusterExpansionZoom: jest.fn(async () => 14) },
  /** The Map's onPress, which a source press bubbles up to. */
  mapPress: undefined as undefined | ((event: object) => void),
};

/**
 * MapLibre is native. The fakes render each pin, one cluster, and the map
 * background as buttons that fire the same press events the real ones do. A
 * source press also reaches the Map's onPress with its features, whatever
 * the source handler does, so the view must not rely on stopPropagation.
 */
jest.mock("@maplibre/maplibre-react-native", () => {
  const React = require("react");
  const { Pressable, View } = require("react-native");
  const h = React.createElement;
  const pressEvent = (feature: object) => ({
    stopPropagation: jest.fn(),
    nativeEvent: { features: [feature] },
  });
  const pressSource = (onPress: (event: object) => void, feature: object) => {
    const event = pressEvent(feature);
    onPress(event);
    mockMap.mapPress?.(event);
  };
  return {
    Map: ({ children, mapStyle, onPress }: any) => {
      mockMap.style = mapStyle;
      mockMap.mapPress = onPress;
      return h(
        View,
        null,
        h(Pressable, {
          accessibilityLabel: "Map background",
          onPress: () => onPress({ nativeEvent: {} }),
        }),
        children,
      );
    },
    Camera: ({ ref }: any) => {
      React.useImperativeHandle(ref, () => mockMap.camera);
      return null;
    },
    GeoJSONSource: ({ ref, data, cluster, onPress, children }: any) => {
      React.useImperativeHandle(ref, () => mockMap.source);
      mockMap.features = data.features;
      mockMap.cluster = cluster;
      return h(
        View,
        null,
        data.features.map((f: any) =>
          h(Pressable, {
            key: f.id,
            accessibilityLabel: `Pin ${f.id}`,
            onPress: () => pressSource(onPress, f),
          }),
        ),
        h(Pressable, {
          accessibilityLabel: "Cluster",
          onPress: () =>
            pressSource(onPress, {
              geometry: { type: "Point", coordinates: [32.57, 0.36] },
              properties: { cluster: true, cluster_id: 7, point_count: 12 },
            }),
        }),
        children,
      );
    },
    Layer: () => null,
    UserLocation: () => null,
  };
});

const ASSETS = fakeMapAssets();
const pole = ASSETS.find((a) => a.id === "EP-00412")!;
/** The device, 38 m north of the pole. */
const HERE = {
  latitude: pole.latitude + 38 / 111_320,
  longitude: pole.longitude,
};

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    status: "granted",
  })),
  getLastKnownPositionAsync: jest.fn(async () => ({ coords: mockHere() })),
  getCurrentPositionAsync: jest.fn(),
}));
const mockHere = () => HERE;

const pin = (id: string) => screen.getByLabelText(`Pin ${id}`);
const shownIds = () => mockMap.features.map((f) => f.properties.id);

async function renderMap(focusId?: string) {
  await render(<AssetMapView focusId={focusId} />);
  // Let the position lookup settle.
  await waitFor(() =>
    expect(
      jest.requireMock("expo-location").getLastKnownPositionAsync,
    ).toHaveBeenCalled(),
  );
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  replaceAssets(ASSETS);
  mapPreferences$.set({ ...DEFAULT_MAP_PREFERENCES });
  isOnline$.set(true);
});

describe("AssetMapView", () => {
  it("shows every asset with search, filters and controls", async () => {
    await renderMap();
    expect(screen.getByLabelText("Search assets or IDs")).toBeOnTheScreen();
    expect(
      screen.getByRole("radio", { name: "All", checked: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Map layers" }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Center on my location" }),
    ).toBeOnTheScreen();
    expect(shownIds()).toHaveLength(ASSETS.length);
    expect(mockMap.style).toBe(BASEMAP_STYLES.streets);
    expect(mockMap.cluster).toBe(true);
    expect(screen.queryByLabelText("Selected asset")).toBeNull();
    expect(screen.queryByText("Offline map · cached tiles")).toBeNull();
  });

  it("filters pins by category and search", async () => {
    await renderMap();
    await fireEvent.press(screen.getByRole("radio", { name: "Water" }));
    expect(new Set(mockMap.features.map((f) => f.properties.category))).toEqual(
      new Set(["water"]),
    );

    await fireEvent.changeText(
      screen.getByLabelText("Search assets or IDs"),
      "borehole",
    );
    expect(shownIds()).toEqual(["WS-00128"]);

    await fireEvent.changeText(
      screen.getByLabelText("Search assets or IDs"),
      "no such asset",
    );
    expect(shownIds()).toEqual([]);
    expect(
      screen.getByText("No assets match. Try another search or category."),
    ).toBeOnTheScreen();
  });

  it("opens the tapped pin's card and closes it from the map", async () => {
    await renderMap();
    await fireEvent.press(pin("EP-00412"));

    const card = screen.getByLabelText("Selected asset");
    expect(
      within(card).getByRole("header", { name: "Concrete pole" }),
    ).toBeOnTheScreen();
    expect(
      within(card).getByText(/^EP-00412 · last seen .* · 38 m away$/),
    ).toBeOnTheScreen();
    expect(within(card).getByText("Inclined 7°")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("Map background"));
    expect(screen.queryByLabelText("Selected asset")).toBeNull();
  });

  it("re-captures the asset or opens its record", async () => {
    await renderMap();
    await fireEvent.press(pin("EP-00412"));
    await fireEvent.press(screen.getByRole("button", { name: "Re-capture" }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/capture",
      params: { category: "energy" },
    });
    await fireEvent.press(screen.getByRole("button", { name: "View record" }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/(tabs)/records/[id]",
      params: { id: "EP-00412" },
    });
  });

  it("shows the asset profile and collapses it for the next pin", async () => {
    await renderMap();
    await fireEvent.press(pin("EP-00412"));
    await fireEvent.press(
      screen.getByRole("button", { name: "Show asset profile" }),
    );
    expect(
      screen.getByRole("header", { name: "Attributes" }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Location" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Record" })).toBeOnTheScreen();

    await fireEvent.press(pin("WS-00128"));
    expect(screen.getByRole("header", { name: "Borehole" })).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Attributes" })).toBeNull();
  });

  it("zooms into a tapped cluster", async () => {
    await renderMap();
    await fireEvent.press(screen.getByLabelText("Cluster"));
    await waitFor(() =>
      expect(mockMap.camera.easeTo).toHaveBeenCalledWith({
        center: [32.57, 0.36],
        zoom: 14,
        duration: 500,
      }),
    );
    expect(mockMap.source.getClusterExpansionZoom).toHaveBeenCalledWith(7);
    expect(screen.queryByLabelText("Selected asset")).toBeNull();
  });

  it("switches the basemap and clustering from the layers sheet", async () => {
    // The clustering Toggle animates its knob.
    jest.useFakeTimers();
    await renderMap();
    await fireEvent.press(screen.getByRole("button", { name: "Map layers" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Satellite" }));
    expect(mockMap.style).toBe(BASEMAP_STYLES.satellite);

    await fireEvent.press(
      screen.getByRole("switch", { name: "Group nearby pins" }),
    );
    expect(mockMap.cluster).toBe(false);
    expect(mapPreferences$.get()).toEqual({
      basemap: "satellite",
      cluster: false,
    });
    await act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it("flies to the device position", async () => {
    await renderMap();
    await fireEvent.press(
      screen.getByRole("button", { name: "Center on my location" }),
    );
    expect(mockMap.camera.flyTo).toHaveBeenCalledWith({
      center: [HERE.longitude, HERE.latitude],
      zoom: 16,
      duration: 800,
    });
  });

  it("says when the basemap comes from cached tiles", async () => {
    isOnline$.set(false);
    await renderMap();
    expect(screen.getByText("Offline map · cached tiles")).toBeOnTheScreen();
  });

  it("selects and centres the asset linked from a record", async () => {
    const asset = ASSETS.find((a) => a.id === "EP-00412")!;
    await renderMap("EP-00412");
    const card = screen.getByLabelText("Selected asset");
    expect(
      within(card).getByRole("header", { name: "Concrete pole" }),
    ).toBeOnTheScreen();
    expect(mockMap.camera.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [asset.longitude, asset.latitude] }),
    );
  });
});
