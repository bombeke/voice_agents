import { fakeFix, fakeGnssSource, FAKE_HEADING } from "../gnss";

describe("fakeFix", () => {
  it("converges from 7.4 m to a floor of 2.8 m", () => {
    expect(fakeFix(0).accuracy).toBe(7.4);
    expect(fakeFix(4).accuracy).toBe(5);
    expect(fakeFix(100).accuracy).toBe(2.8);
  });

  it("reports more satellites once under 4 m", () => {
    expect(fakeFix(0)).toMatchObject({
      satellites: 14,
      fixType: "3D",
      bands: "L1+L5",
    });
    expect(fakeFix(10).satellites).toBe(18);
  });
});

describe("fakeGnssSource", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("streams a heading and fixes until stopped", async () => {
    const listener = {
      onFix: jest.fn(),
      onHeading: jest.fn(),
      onError: jest.fn(),
    };
    const stop = await fakeGnssSource.start(listener);
    expect(listener.onHeading).toHaveBeenCalledWith(FAKE_HEADING);
    jest.advanceTimersByTime(700 * 3);
    expect(listener.onFix).toHaveBeenCalledTimes(4);
    stop();
    jest.advanceTimersByTime(700 * 3);
    expect(listener.onFix).toHaveBeenCalledTimes(4);
  });
});
