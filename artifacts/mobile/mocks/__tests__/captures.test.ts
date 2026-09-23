import { summariseToday } from "@/helpers/captureStats";
import { countRecords } from "@/helpers/records";
import { isOnline$ } from "@/services/storage/LegendState";
import { fakeCaptureUploader, fakeCaptures } from "../captures";

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

describe("fakeCaptureUploader", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    isOnline$.set(true);
  });

  async function upload() {
    const result = fakeCaptureUploader(fakeCaptures().slice(0, 2));
    await jest.runAllTimersAsync();
    return result;
  }

  it("uploads everything while online", async () => {
    expect(await upload()).toEqual({
      synced: ["fake-capture-1", "fake-capture-2"],
      failed: [],
    });
  });

  it("settles nothing while offline", async () => {
    isOnline$.set(false);
    expect(await upload()).toEqual({ synced: [], failed: [] });
  });
});
