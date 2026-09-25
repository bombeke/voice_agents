import type { CaptureLocation, Vec3 } from "@/types/Capture";
import { act, renderHook } from "@testing-library/react-native";
import { Image } from "react-native";
import { MANUAL_TRACK_ID, targetPosition, useArCapture } from "../useArCapture";

// The AR frame decoder imports Skia; the detector never loads in these tests.
jest.mock("@shopify/react-native-skia", () => ({ Skia: {} }));

const LOCATION: CaptureLocation = {
  latitude: 0.3136,
  longitude: 32.5811,
  accuracy: 2.8,
  altitude: 1190,
  satellites: 18,
  flags: [],
};

const GROUND: Vec3 = [0, 0, -10];

async function setup() {
  const hook = await renderHook(() => useArCapture("energy", false));
  const { bridge } = hook.result.current;
  const scene = {
    performARHitTestWithPoint: jest.fn(async () => [
      { type: "ExistingPlaneUsingExtent", transform: { position: GROUND } },
    ]),
  };
  const navigator = {
    takeScreenshot: jest.fn(async () => ({
      success: true,
      url: "/tmp/ar.jpg",
    })),
    // 1000 view units per metre at one metre ahead.
    project: jest.fn(async (p: Vec3) => ({
      screenPosition: [200 + p[0] * 1000, 400, 0],
    })),
  };
  bridge.scene = scene;
  bridge.navigator = navigator;
  bridge.pose = {
    position: [0, 1.5, 0],
    rotation: [0, 0, 0],
    forward: [0, 0, -1],
    up: [0, 1, 0],
    timestamp: 1,
  };
  await act(async () => bridge.tracking$.set("normal"));
  await act(async () =>
    hook.result.current.onViewport({ width: 400, height: 800 }),
  );
  return { ...hook, scene, navigator, bridge };
}

beforeEach(() => {
  jest.spyOn(Image, "getSize").mockImplementation((_uri, ok) => ok(1080, 2400));
});
afterEach(() => jest.restoreAllMocks());

describe("useArCapture", () => {
  it("places the asset where the surveyor taps its base", async () => {
    const { result, scene, bridge } = await setup();
    await act(async () => result.current.setPlacing(true));
    expect(result.current.placing).toBe(true);

    let placed = false;
    await act(async () => {
      placed = await result.current.placeAt({ x: 200, y: 700 });
    });
    expect(placed).toBe(true);
    expect(scene.performARHitTestWithPoint).toHaveBeenCalledWith(200, 700);
    expect(result.current.placing).toBe(false);
    expect(result.current.target).toMatchObject({
      trackId: MANUAL_TRACK_ID,
      source: "ar_tap",
      distanceM: 10,
    });
    expect(bridge.marker$.peek()).toEqual(GROUND);
  });

  it("reports a tap that finds no ground", async () => {
    const { result, scene } = await setup();
    scene.performARHitTestWithPoint.mockResolvedValueOnce([]);
    let placed = true;
    await act(async () => {
      placed = await result.current.placeAt({ x: 10, y: 10 });
    });
    expect(placed).toBe(false);
    expect(result.current.target).toBeNull();
  });

  it("shoots the AR view with the pose, lens and a positioned asset", async () => {
    const { result, navigator, bridge } = await setup();
    await act(async () => {
      await result.current.placeAt({ x: 200, y: 700 });
    });

    let shot!: Awaited<ReturnType<typeof result.current.shoot>>;
    await act(async () => {
      shot = await result.current.shoot({
        location: LOCATION,
        latest: null,
        heading: 90,
      });
    });

    expect(shot.path).toBe("/tmp/ar.jpg");
    expect(navigator.takeScreenshot).toHaveBeenCalledWith(
      expect.stringMatching(/^capture-/),
      false,
    );
    expect(shot.metadata).toMatchObject({
      engine: "ar",
      cameraHeightM: 1.5,
      intrinsics: {
        width: 1080,
        height: 2400,
        // 1000 per metre in a 400-wide view, scaled to 1080 px.
        focalLengthPx: expect.closeTo(2700),
      },
      ar: { trackingState: "normal" },
      device: { heading: 90, latitude: 0.3136 },
    });
    expect(shot.detections).toEqual([
      expect.objectContaining({
        trackId: MANUAL_TRACK_ID,
        manual: true,
        position: expect.objectContaining({
          source: "ar_tap",
          distanceM: expect.closeTo(10),
          bearingDeg: expect.closeTo(90),
        }),
      }),
    ]);
    // The ring is hidden for the photo and put back after.
    expect(bridge.marker$.peek()).toEqual(GROUND);
  });
});

describe("targetPosition", () => {
  it("needs a target, pose, fix and heading", () => {
    const target = {
      trackId: 1,
      hit: { type: "ExistingPlane", position: GROUND },
      source: "ar_auto" as const,
      distanceM: 10,
    };
    const pose = {
      position: [0, 1.5, 0] as Vec3,
      rotation: [0, 0, 0] as Vec3,
      forward: [0, 0, -1] as Vec3,
      up: [0, 1, 0] as Vec3,
      trackingState: "normal" as const,
      timestamp: 0,
    };
    expect(targetPosition(target, pose, LOCATION, 0)).toMatchObject({
      distanceM: expect.closeTo(10),
      bearingDeg: expect.closeTo(0),
    });
    expect(targetPosition(target, pose, LOCATION, null)).toBeNull();
    expect(targetPosition(null, pose, LOCATION, 0)).toBeNull();
  });
});
