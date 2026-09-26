import { reviewDecisions } from "@/db/schema";
import { setupTestDatabase } from "@/db/testing/TestDb";
import { fakeReviewQueue } from "@/mocks/reviews";
import { applyReviewBatch } from "@/services/storage/ReviewStore";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useReviewQueue } from "../useReviewQueue";

const QUEUE = fakeReviewQueue([], new Date(2026, 8, 24, 10, 0));
const getDb = setupTestDatabase();

beforeEach(() =>
  applyReviewBatch({ batchId: "b1", items: QUEUE, records: [] }),
);

async function render() {
  const hook = await renderHook(() => useReviewQueue());
  await waitFor(() => expect(hook.result.current.total).toBe(4));
  return hook;
}

describe("useReviewQueue", () => {
  it("lists the whole queue, newest first, to start with", async () => {
    const { result } = await render();
    expect(result.current.filter).toBe("all");
    expect(result.current.items.map((i) => i.title)).toEqual([
      "Culvert · pipe",
      "Public tap",
      "Transformer",
      "Telecom pole",
    ]);
    expect(result.current.batch).toMatchObject({ id: "b1", size: 4 });
  });

  it("filters by reason without changing the total", async () => {
    const { result } = await render();
    await act(() => result.current.setFilter("gps"));
    await waitFor(() =>
      expect(result.current.items.map((i) => i.title)).toEqual(["Public tap"]),
    );
    expect(result.current.total).toBe(4);
  });

  it("approves and rejects, and counts what is still unsent", async () => {
    const { result } = await render();
    const [culvert, tap] = result.current.items;
    await act(() => result.current.approve(culvert));
    await act(() => result.current.reject(tap, "bad_location"));
    await waitFor(() => expect(result.current.total).toBe(2));
    expect(result.current.unsent).toBe(2);
    const decided = await getDb().orm.select().from(reviewDecisions);
    expect(
      Object.fromEntries(
        decided.map((d) => [d.itemId, [d.outcome, d.rejectReason]]),
      ),
    ).toEqual({
      [culvert.id]: ["approved", null],
      [tap.id]: ["rejected", "bad_location"],
    });
  });

  it("keeps its callbacks across queue updates", async () => {
    const { result } = await render();
    const { approve, reject } = result.current;
    await act(() => result.current.approve(result.current.items[0]));
    await waitFor(() => expect(result.current.total).toBe(3));
    expect(result.current.approve).toBe(approve);
    expect(result.current.reject).toBe(reject);
  });
});
