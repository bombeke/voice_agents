import {
  addCapture,
  clearCaptures,
  gnssStatus$,
} from "@/services/storage/CaptureStore";
import { act, renderHook } from "@testing-library/react-native";
import { useCaptureSummary } from "../useCaptureSummary";

beforeEach(() => {
  clearCaptures();
  gnssStatus$.set(null);
});

describe("useCaptureSummary", () => {
  it("updates when a capture is saved", async () => {
    const { result } = await renderHook(() => useCaptureSummary());
    expect(result.current.stats.capturedToday).toBe(0);
    expect(result.current.latest).toBeUndefined();

    await act(async () => {
      addCapture({
        id: "a",
        category: "roads",
        title: "Culvert · blocked",
        capturedAt: new Date().toISOString(),
        accuracyM: 3.2,
        syncStatus: "pending",
        flagged: false,
      });
      gnssStatus$.set({ bands: "L1+L5", ok: true });
    });

    expect(result.current.stats).toMatchObject({
      capturedToday: 1,
      pending: 1,
    });
    expect(result.current.latest?.title).toBe("Culvert · blocked");
    expect(result.current.gnss).toEqual({ bands: "L1+L5", ok: true });
  });
});
