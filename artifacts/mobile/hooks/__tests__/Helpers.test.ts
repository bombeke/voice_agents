import { rgbaToFloatRGB, toDecimal } from "../Helpers";

// Helpers imports Skia for base64ToTensor, which these tests don't cover.
jest.mock("@shopify/react-native-skia", () => ({ Skia: {} }));

describe("toDecimal", () => {
  it("converts EXIF degrees/minutes/seconds", () => {
    expect(toDecimal(["0", "20", "51.36"], "N")).toBeCloseTo(0.3476, 4);
  });

  it("negates southern and western references", () => {
    expect(toDecimal([1, 30, 0], "S")).toBe(-1.5);
    expect(toDecimal([32, 30, 0], "W")).toBe(-32.5);
    expect(toDecimal([32, 30, 0], "E")).toBe(32.5);
  });

  it("returns null without a value", () => {
    expect(toDecimal(undefined, "N")).toBeNull();
    expect(toDecimal(null, "N")).toBeNull();
  });
});

describe("rgbaToFloatRGB", () => {
  it("drops alpha and normalises to 0..1", () => {
    const rgba = new Uint8ClampedArray([255, 0, 51, 255, 0, 255, 102, 0]);
    expect(Array.from(rgbaToFloatRGB(rgba, 2, 1))).toEqual(
      [1, 0, 0.2, 0, 1, 0.4].map((v) => Math.fround(v)),
    );
  });
});
