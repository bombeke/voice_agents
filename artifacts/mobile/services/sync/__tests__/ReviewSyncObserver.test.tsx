import { isOnline$ } from "@/services/storage/NetworkState";
import { reviewDecisions$ } from "@/services/storage/ReviewStore";
import { act, render } from "@testing-library/react-native";
import { ReviewSyncObserver } from "../ReviewSyncObserver";

const mockUpload = jest.fn(async () => 0);
const mockRefresh = jest.fn(async () => true);
jest.mock("../ReviewSync", () => ({
  uploadReviewDecisions: () => mockUpload(),
  refreshMyReviews: () => mockRefresh(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  isOnline$.set(true);
  reviewDecisions$.set({});
});

describe("ReviewSyncObserver", () => {
  it("syncs on sign-in, on a new decision and on reconnect", async () => {
    await render(<ReviewSyncObserver />);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    await act(() =>
      reviewDecisions$.set({
        i1: {
          itemId: "i1",
          outcome: "approved",
          decidedAt: "2026-09-24T10:00:00.000Z",
          syncStatus: "pending",
        },
      }),
    );
    expect(mockUpload).toHaveBeenCalledTimes(2);

    await act(() => isOnline$.set(false));
    await act(() => isOnline$.set(true));
    expect(mockUpload).toHaveBeenCalledTimes(3);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it("stops listening once signed out", async () => {
    const { unmount } = await render(<ReviewSyncObserver />);
    await act(() => unmount());
    mockUpload.mockClear();
    await act(() => isOnline$.set(false));
    await act(() => isOnline$.set(true));
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
