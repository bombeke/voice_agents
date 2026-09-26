import { seedCaptures, setupTestDatabase } from "@/db/testing/TestDb";
import { gnssStatus$ } from "@/services/storage/CaptureStore";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useCaptureSummary } from "../useCaptureSummary";

const getDb = setupTestDatabase();

beforeEach(() => gnssStatus$.set(null));

describe("useCaptureSummary", () => {
  it("updates when a capture is saved", async () => {
    const { result } = await renderHook(() => useCaptureSummary());
    expect(result.current.stats.capturedToday).toBe(0);
    expect(result.current.latest).toBeUndefined();

    await act(async () => {
      await seedCaptures(getDb(), [
        {
          id: "a",
          category: "roads",
          title: "Culvert · blocked",
          capturedAt: new Date().toISOString(),
          accuracyM: 3.2,
          syncStatus: "pending",
          flagged: false,
        },
        {
          id: "old",
          category: "roads",
          title: "Drain",
          capturedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
          accuracyM: 3.2,
          syncStatus: "pending",
          flagged: true,
        },
      ]);
      gnssStatus$.set({ bands: "L1+L5", ok: true });
    });

    await waitFor(() =>
      expect(result.current.stats).toEqual({
        capturedToday: 1,
        synced: 0,
        flagged: 0,
        pending: 2,
      }),
    );
    expect(result.current.latest?.title).toBe("Culvert · blocked");
    expect(result.current.gnss).toEqual({ bands: "L1+L5", ok: true });
  });
});
