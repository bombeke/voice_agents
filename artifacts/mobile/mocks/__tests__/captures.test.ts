import { summariseToday } from "@/helpers/captureStats";
import { countRecords } from "@/helpers/records";
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
    expect(countRecords(captures)).toMatchObject({
      all: 14,
      pending: 3,
      flagged: 1,
    });
    expect(captures[0]).toMatchObject({
      title: "Concrete pole",
      detail: "2 detections",
      assetId: "EP-00412",
    });
  });
});
