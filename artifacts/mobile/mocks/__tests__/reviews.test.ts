import { fakeCaptures } from "../captures";
import { fakeReviewQueue } from "../reviews";

const NOW = new Date(2026, 8, 24, 10, 0);

describe("fakeReviewQueue", () => {
  it("has the mockup's four records, one per reason", () => {
    const queue = fakeReviewQueue([], NOW);
    expect(queue.map((i) => [i.title, i.reason.kind])).toEqual([
      ["Culvert · pipe", "low_confidence"],
      ["Public tap", "gps_unverified"],
      ["Transformer", "heavy_edits"],
      ["Telecom pole", "duplicate"],
    ]);
    expect(new Set(queue.map((i) => i.id)).size).toBe(4);
  });

  it("links items to the fake captures they match, and takes their time", () => {
    const captures = fakeCaptures(NOW);
    const queue = fakeReviewQueue(captures, NOW);
    const culvert = captures.find((c) => c.title === "Culvert · pipe")!;
    expect(queue[0]).toMatchObject({
      captureId: culvert.id,
      capturedAt: culvert.capturedAt,
    });
    // No fake capture is a "Telecom pole".
    expect(queue[3].captureId).toBeUndefined();
  });
});
