import { declinationFrom } from "../GnssSource";

describe("declinationFrom", () => {
  it("is true minus magnetic heading, across north", () => {
    expect(declinationFrom(100, 97)).toBeCloseTo(3);
    expect(declinationFrom(2, 358)).toBeCloseTo(4);
    expect(declinationFrom(355, 5)).toBeCloseTo(-10);
  });
});
