import { fill, formatHeading } from "../format";

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
