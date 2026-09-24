import { fakeCaptures } from "@/mocks/captures";
import { fakeReviewQueue } from "@/mocks/reviews";
import { replaceCaptures } from "@/services/storage/CaptureStore";
import { isOnline$ } from "@/services/storage/NetworkState";
import {
  clearReviews,
  replaceMyReviews,
  replaceReviewQueue,
  reviewBatch$,
} from "@/services/storage/ReviewStore";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ReviewQueueView } from "../ReviewQueueView";

const mockRouter = { push: jest.fn() };
const mockDownload = jest.fn(async () => ({ ok: true, added: 3 }));
jest.mock("@/services/sync/ReviewSync", () => ({
  downloadReviewBatch: () => mockDownload(),
}));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

const CAPTURES = fakeCaptures();

beforeEach(() => {
  mockRouter.push.mockClear();
  mockDownload.mockClear();
  isOnline$.set(true);
  clearReviews();
  replaceCaptures(CAPTURES);
  replaceReviewQueue(fakeReviewQueue(CAPTURES));
});

const title = () => screen.getByRole("header").props.children;

describe("ReviewQueueView", () => {
  it("shows the supervisor's queue with its count", async () => {
    await render(<ReviewQueueView canDecide />);
    expect(screen.getByText("Supervisor")).toBeOnTheScreen();
    expect(title()).toBe("Review queue · 4");
    expect(screen.getByRole("tab", { name: "All reasons" })).toBeSelected();
    for (const name of ["Culvert · pipe", "Public tap", "Transformer"]) {
      expect(screen.getByText(name)).toBeOnTheScreen();
    }
  });

  it("filters by reason but keeps the total in the title", async () => {
    await render(<ReviewQueueView canDecide />);
    await fireEvent.press(screen.getByRole("tab", { name: "GPS" }));
    expect(screen.getByText("Public tap")).toBeOnTheScreen();
    expect(screen.queryByText("Culvert · pipe")).not.toBeOnTheScreen();
    expect(title()).toBe("Review queue · 4");
  });

  it("removes a card once it is approved or rejected", async () => {
    await render(<ReviewQueueView canDecide />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Approve Culvert · pipe" }),
    );
    expect(screen.queryByText("Culvert · pipe")).not.toBeOnTheScreen();
    expect(title()).toBe("Review queue · 3");

    await fireEvent.press(
      screen.getByRole("button", { name: "Reject Public tap" }),
    );
    await fireEvent.press(screen.getByRole("radio", { name: "Bad location" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm reject" }),
    );
    expect(screen.queryByText("Public tap")).not.toBeOnTheScreen();
    expect(title()).toBe("Review queue · 2");
  });

  it("opens the reviewed record", async () => {
    await render(<ReviewQueueView canDecide />);
    await fireEvent.press(
      screen.getByRole("button", { name: /Culvert · pipe.*Open record/ }),
    );
    const culvert = CAPTURES.find((c) => c.title === "Culvert · pipe")!;
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/(tabs)/records/[id]",
      params: { id: culvert.id },
    });
  });

  it("says when a filter has nothing waiting", async () => {
    replaceReviewQueue(fakeReviewQueue(CAPTURES).slice(0, 2));
    await render(<ReviewQueueView canDecide />);
    await fireEvent.press(screen.getByRole("tab", { name: "Duplicates" }));
    expect(
      screen.getByText("No records waiting for this reason."),
    ).toBeOnTheScreen();
  });

  it("says when the queue is clear", async () => {
    clearReviews();
    await render(<ReviewQueueView canDecide />);
    expect(title()).toBe("Review queue · 0");
    expect(
      screen.getByText("The queue is clear. Download a batch to review more."),
    ).toBeOnTheScreen();
  });

  it("downloads the next batch when online, and not offline", async () => {
    reviewBatch$.set({
      id: "b1",
      downloadedAt: new Date().toISOString(),
      size: 4,
    });
    await render(<ReviewQueueView canDecide />);
    expect(
      screen.getByText(/^Batch of 4 · downloaded today/),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Download next batch" }),
    );
    expect(mockDownload).toHaveBeenCalled();
    expect(
      await screen.findByText("3 records added to your queue."),
    ).toBeOnTheScreen();

    await act(() => isOnline$.set(false));
    expect(
      screen.getByRole("button", { name: "Download next batch" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Connect to download a batch. Decisions made offline upload later.",
      ),
    ).toBeOnTheScreen();
  });

  it("counts decisions waiting to upload", async () => {
    isOnline$.set(false);
    await render(<ReviewQueueView canDecide />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Approve Culvert · pipe" }),
    );
    expect(screen.getByText("1 decision waiting to upload")).toBeOnTheScreen();
  });

  it("switches a supervisor to their own records", async () => {
    await render(<ReviewQueueView canDecide />);
    await fireEvent.press(screen.getByRole("tab", { name: "My records" }));
    expect(title()).toBe("My records in review · 1");
    expect(
      screen.getByRole("button", { name: /Culvert · pipe.*Waiting/ }),
    ).toBeOnTheScreen();
  });

  it("shows an enumerator only their own records and the verdicts", async () => {
    const culvert = CAPTURES.find((c) => c.title === "Culvert · pipe")!;
    replaceMyReviews([
      { captureId: culvert.id, state: "rejected", rejectReason: "poor_photo" },
    ]);
    await render(<ReviewQueueView canDecide={false} />);
    expect(screen.getByText("Review")).toBeOnTheScreen();
    expect(title()).toBe("My records in review · 1");
    expect(screen.queryByRole("tab", { name: "Team queue" })).toBeNull();
    expect(
      screen.getByText("Rejected: Poor photo. Edit the record to fix it."),
    ).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole("button", { name: /Culvert · pipe.*Rejected/ }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/(tabs)/records/[id]",
      params: { id: culvert.id },
    });
  });

  it("tells an enumerator when nothing is under review", async () => {
    replaceCaptures(CAPTURES.filter((c) => !c.flagged));
    await render(<ReviewQueueView canDecide={false} />);
    expect(
      screen.getByText("None of your records are waiting for a supervisor."),
    ).toBeOnTheScreen();
  });
});
