import {
  createArBridge,
  currentPose,
  projectedPoint,
  screenshotUri,
} from "../ArBridge";

describe("ArBridge", () => {
  it("starts untracked with no pose or marker", () => {
    const bridge = createArBridge();
    expect(bridge.tracking$.peek()).toBe("unavailable");
    expect(bridge.marker$.peek()).toBeNull();
    expect(currentPose(bridge)).toBeNull();
  });

  it("stamps the pose with the tracking state it was read under", () => {
    const bridge = createArBridge();
    bridge.pose = {
      position: [0, 1.5, 0],
      rotation: [0, 0, 0],
      forward: [0, 0, -1],
      up: [0, 1, 0],
      timestamp: 5,
    };
    bridge.tracking$.set("normal");
    expect(currentPose(bridge)).toMatchObject({
      trackingState: "normal",
      timestamp: 5,
    });
  });

  it("reads Viro's screenshot and projection results", () => {
    expect(screenshotUri({ success: true, url: "/data/shot.jpg" })).toBe(
      "/data/shot.jpg",
    );
    expect(screenshotUri({ success: false, url: "/x.jpg" })).toBeNull();
    expect(screenshotUri(null)).toBeNull();
    expect(projectedPoint({ screenPosition: [10, 20, 0.5] })).toEqual({
      x: 10,
      y: 20,
    });
    expect(projectedPoint({})).toBeNull();
  });
});
