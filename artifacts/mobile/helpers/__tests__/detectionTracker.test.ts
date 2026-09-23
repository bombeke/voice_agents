import {
  createTrackerState,
  iou,
  MAX_COAST,
  updateTracks,
  visibleTracks,
  type Box,
  type Detection,
} from "../detectionTracker";

const box = (x: number, y: number, w = 50, h = 100): Box => ({
  xmin: x,
  ymin: y,
  xmax: x + w,
  ymax: y + h,
});
const det = (b: Box, label = "pole", confidence = 0.9): Detection => ({
  box: b,
  label,
  confidence,
});

describe("iou", () => {
  it("is 1 for identical boxes and 0 for disjoint ones", () => {
    expect(iou(box(0, 0), box(0, 0))).toBeCloseTo(1);
    expect(iou(box(0, 0), box(200, 200))).toBe(0);
  });
});

describe("updateTracks", () => {
  it("keeps the same id while a box moves across frames", () => {
    const state = createTrackerState();
    const ids = [0, 8, 16, 24].map(
      (x) => updateTracks(state, [det(box(100 + x, 50))])[0].trackId,
    );
    expect(new Set(ids).size).toBe(1);
  });

  it("hides a new track until it has been seen twice", () => {
    const state = createTrackerState();
    expect(visibleTracks(updateTracks(state, [det(box(0, 0))]))).toHaveLength(
      0,
    );
    expect(visibleTracks(updateTracks(state, [det(box(2, 0))]))).toHaveLength(
      1,
    );
  });

  it("predicts a lost track forward, then drops it after coasting", () => {
    const state = createTrackerState();
    updateTracks(state, [det(box(100, 0))]);
    updateTracks(state, [det(box(110, 0))]);
    const coasting = updateTracks(state, []);
    expect(coasting).toHaveLength(1);
    // Moved on by its velocity rather than frozen.
    expect(coasting[0].box.xmin).toBeGreaterThan(110);

    for (let i = 0; i < MAX_COAST; i++) updateTracks(state, []);
    expect(state.tracks).toHaveLength(0);
  });

  it("never continues a track with a detection of a different label", () => {
    const state = createTrackerState();
    const [pole] = updateTracks(state, [det(box(0, 0), "pole")]);
    const next = updateTracks(state, [det(box(0, 0), "transformer")]);
    const transformer = next.find((t) => t.label === "transformer")!;
    expect(transformer.trackId).not.toBe(pole.trackId);
  });

  it("matches each track to at most one detection per frame", () => {
    const state = createTrackerState();
    updateTracks(state, [det(box(0, 0))]);
    const next = updateTracks(state, [det(box(0, 0)), det(box(2, 0))]);
    const ids = next.filter((t) => t.age === 0).map((t) => t.trackId);
    expect(new Set(ids).size).toBe(2);
  });
});
