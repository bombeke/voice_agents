import {
  computeViewportTransform,
  toFrameFraction,
  toScreenRect,
  unrotateAndroidBox,
} from "../detectionGeometry";

const INPUT = { width: 384, height: 384 };

describe("computeViewportTransform", () => {
  it("returns the identity for an unmeasured viewport", () => {
    expect(computeViewportTransform({ width: 0, height: 0 }, INPUT)).toEqual({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("maps the square input onto a portrait preview of a portrait frame", () => {
    // 1080×1920 frame; the resizer covers 384² from the centre 1080² square.
    // The preview covers 390×844 → the frame scales by 844/1920.
    const t = computeViewportTransform({ width: 390, height: 844 }, INPUT, {
      width: 1080,
      height: 1920,
    });
    const viewScale = 844 / 1920;
    const resizerScale = 384 / 1080;
    expect(t.scale).toBeCloseTo(viewScale / resizerScale);
    // The input's centre lands on the preview's centre.
    expect(t.offsetX + 192 * t.scale).toBeCloseTo(195);
    expect(t.offsetY + 192 * t.scale).toBeCloseTo(422);
  });

  it("covers the viewport with the input when the frame size is unknown", () => {
    const t = computeViewportTransform({ width: 400, height: 800 }, INPUT);
    expect(t.scale).toBeCloseTo(800 / 384);
    expect(t.offsetY).toBeCloseTo(0);
  });
});

describe("toScreenRect", () => {
  it("scales, offsets and clamps a box to the viewport", () => {
    const rect = toScreenRect(
      { xmin: -10, ymin: 10, xmax: 100, ymax: 50 },
      { scale: 2, offsetX: 5, offsetY: 0 },
      { width: 150, height: 1000 },
    );
    expect(rect).toEqual({ left: 0, top: 20, width: 150, height: 80 });
  });
});

describe("unrotateAndroidBox", () => {
  const b = { xmin: 10, ymin: 20, xmax: 50, ymax: 80 };

  it("mirrors both axes for Android sideways frames", () => {
    expect(unrotateAndroidBox(b, INPUT, true, true)).toEqual({
      xmin: 334,
      xmax: 374,
      ymin: 304,
      ymax: 364,
    });
  });

  it("leaves iOS and upright frames alone", () => {
    expect(unrotateAndroidBox(b, INPUT, false, true)).toBe(b);
    expect(unrotateAndroidBox(b, INPUT, true, false)).toBe(b);
  });
});

describe("toFrameFraction", () => {
  it("undoes the centred cover crop into 0–1 frame fractions", () => {
    // 1080×1920 portrait frame: the 384² input shows the middle 1080² square.
    const frac = toFrameFraction(
      { xmin: 0, ymin: 0, xmax: 384, ymax: 384 },
      INPUT,
      { width: 1080, height: 1920 },
    );
    expect(frac.xmin).toBeCloseTo(0);
    expect(frac.xmax).toBeCloseTo(1);
    expect(frac.ymin).toBeCloseTo(420 / 1920);
    expect(frac.ymax).toBeCloseTo(1500 / 1920);
  });
});
