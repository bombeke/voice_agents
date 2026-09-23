import { summariseToday } from "@/helpers/captureStats";
import { fakeCaptures } from "../captures";

describe("fakeCaptures", () => {
  it.each([
    ["mid-morning", new Date(2026, 8, 23, 10, 14)],
    ["just after midnight", new Date(2026, 8, 23, 0, 5)],
  ])("matches the Home mockup %s", (_, now) => {
    const captures = fakeCaptures(now);
    expect(summariseToday(captures, now)).toEqual({
      capturedToday: 14,
      synced: 11,
      flagged: 1,
      pending: 3,
    });
    expect(captures[0].title).toBe("Concrete pole · inclined 7°");
  });
});
