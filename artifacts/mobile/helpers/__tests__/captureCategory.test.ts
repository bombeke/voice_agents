import { parseCaptureCategory } from "../captureCategory";

describe("parseCaptureCategory", () => {
  it("accepts the four categories and auto", () => {
    for (const c of ["energy", "water", "telecom", "roads", "auto"]) {
      expect(parseCaptureCategory(c)).toBe(c);
    }
  });

  it("uses the first value of a repeated param", () => {
    expect(parseCaptureCategory(["water", "roads"])).toBe("water");
  });

  it("falls back to auto for anything else", () => {
    expect(parseCaptureCategory(undefined)).toBe("auto");
    expect(parseCaptureCategory("rail")).toBe("auto");
  });
});
