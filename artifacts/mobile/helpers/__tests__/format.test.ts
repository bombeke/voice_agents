import {
  fill,
  formatClock,
  formatCoordinates,
  formatHeading,
  isSameLocalDay,
} from "../format";

describe("fill", () => {
  it("replaces known placeholders and leaves unknown ones", () => {
    expect(fill("{count} sats · {x}", { count: 18 })).toBe("18 sats · {x}");
  });
});

describe("formatHeading", () => {
  it("adds the nearest compass point", () => {
    expect(formatHeading(142)).toBe("142° SE");
    expect(formatHeading(0)).toBe("0° N");
    expect(formatHeading(359.6)).toBe("0° N");
    expect(formatHeading(-90)).toBe("270° W");
  });
});

describe("formatClock", () => {
  it("pads local hours and minutes", () => {
    expect(formatClock(new Date(2026, 8, 23, 9, 5))).toBe("09:05");
    expect(formatClock(new Date(2026, 8, 23, 23, 59))).toBe("23:59");
  });
});

describe("isSameLocalDay", () => {
  it("compares local calendar days", () => {
    const day = new Date(2026, 8, 23, 0, 0);
    expect(isSameLocalDay(day, new Date(2026, 8, 23, 23, 59))).toBe(true);
    expect(isSameLocalDay(day, new Date(2026, 8, 22, 23, 59))).toBe(false);
    expect(isSameLocalDay(day, new Date(2025, 8, 23, 12))).toBe(false);
  });
});

describe("formatCoordinates", () => {
  it("writes hemispheres instead of signs", () => {
    expect(formatCoordinates(0.313584, 32.581061)).toBe(
      "0.31358 N, 32.58106 E",
    );
    expect(formatCoordinates(-1.2, -0.5, 2)).toBe("1.20 S, 0.50 W");
  });
});
