import { fakeReviewQueue } from "@/mocks/reviews";
import {
  clearReviews,
  replaceReviewQueue,
  reviewDecisions$,
} from "@/services/storage/ReviewStore";
import { act, renderHook } from "@testing-library/react-native";
import { useReviewQueue } from "../useReviewQueue";

const QUEUE = fakeReviewQueue([], new Date(2026, 8, 24, 10, 0));

beforeEach(() => {
  clearReviews();
  replaceReviewQueue(QUEUE);
});

describe("useReviewQueue", () => {
  it("lists the whole queue, newest first, to start with", async () => {
    const { result } = await renderHook(() => useReviewQueue());
    expect(result.current.filter).toBe("all");
    expect(result.current.total).toBe(4);
    expect(result.current.items.map((i) => i.title)).toEqual([
      "Culvert · pipe",
      "Public tap",
      "Transformer",
      "Telecom pole",
    ]);
  });

  it("filters by reason without changing the total", async () => {
    const { result } = await renderHook(() => useReviewQueue());
    await act(() => result.current.setFilter("gps"));
    expect(result.current.items.map((i) => i.title)).toEqual(["Public tap"]);
    expect(result.current.total).toBe(4);
  });

  it("approves and rejects through the store", async () => {
    const { result } = await renderHook(() => useReviewQueue());
    const [culvert, tap] = result.current.items;
    await act(() => {
      result.current.approve(culvert);
    });
    await act(() => {
      result.current.reject(tap, "bad_location");
    });
    expect(result.current.total).toBe(2);
    expect(reviewDecisions$.get()).toMatchObject({
      [culvert.id]: { outcome: "approved" },
      [tap.id]: { outcome: "rejected", rejectReason: "bad_location" },
    });
  });

  it("keeps its callbacks across queue updates", async () => {
    const { result } = await renderHook(() => useReviewQueue());
    const { approve, reject } = result.current;
    await act(() => {
      result.current.approve(result.current.items[0]);
    });
    expect(result.current.approve).toBe(approve);
    expect(result.current.reject).toBe(reject);
  });
});
