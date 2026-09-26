import { dbEpoch$ } from "@/db/Current";
import { isOnline$ } from "@/services/storage/NetworkState";
import { act, render } from "@testing-library/react-native";
import { ReviewSyncObserver } from "../ReviewSyncObserver";

const mockRefresh = jest.fn(async () => true);
jest.mock("../ReviewSync", () => ({
  refreshMyReviews: () => mockRefresh(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  isOnline$.set(true);
});

describe("ReviewSyncObserver", () => {
  it("refreshes the user's verdicts on sign-in, on a user switch and on reconnect", async () => {
    await render(<ReviewSyncObserver />);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    await act(() => dbEpoch$.set((n) => n + 1));
    expect(mockRefresh).toHaveBeenCalledTimes(2);

    await act(() => isOnline$.set(false));
    await act(() => isOnline$.set(true));
    expect(mockRefresh).toHaveBeenCalledTimes(3);
  });

  it("stops listening once signed out", async () => {
    const { unmount } = await render(<ReviewSyncObserver />);
    await act(() => unmount());
    mockRefresh.mockClear();
    await act(() => isOnline$.set(false));
    await act(() => isOnline$.set(true));
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
