import { fakeCaptures } from "@/mocks/captures";
import { fakeReviewQueue } from "@/mocks/reviews";
import { replaceCaptures } from "@/services/storage/CaptureStore";
import {
  clearReviews,
  replaceReviewQueue,
} from "@/services/storage/ReviewStore";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ReviewQueueView } from "../ReviewQueueView";

const mockRouter = { push: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

const CAPTURES = fakeCaptures();

beforeEach(() => {
  mockRouter.push.mockClear();
  clearReviews();
  replaceCaptures(CAPTURES);
  replaceReviewQueue(fakeReviewQueue(CAPTURES));
});

const title = () => screen.getByRole("header").props.children;

describe("ReviewQueueView", () => {
  it("shows the supervisor's queue with its count", async () => {
    await render(<ReviewQueueView />);
    expect(screen.getByText("Supervisor")).toBeOnTheScreen();
    expect(title()).toBe("Review queue · 4");
    expect(screen.getByRole("tab", { name: "All reasons" })).toBeSelected();
    for (const name of ["Culvert · pipe", "Public tap", "Transformer"]) {
      expect(screen.getByText(name)).toBeOnTheScreen();
    }
  });

  it("filters by reason but keeps the total in the title", async () => {
    await render(<ReviewQueueView />);
    await fireEvent.press(screen.getByRole("tab", { name: "GPS" }));
    expect(screen.getByText("Public tap")).toBeOnTheScreen();
    expect(screen.queryByText("Culvert · pipe")).not.toBeOnTheScreen();
    expect(title()).toBe("Review queue · 4");
  });

  it("removes a card once it is approved or rejected", async () => {
    await render(<ReviewQueueView />);
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
    await render(<ReviewQueueView />);
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
    await render(<ReviewQueueView />);
    await fireEvent.press(screen.getByRole("tab", { name: "Duplicates" }));
    expect(
      screen.getByText("No records waiting for this reason."),
    ).toBeOnTheScreen();
  });

  it("says when the queue is clear", async () => {
    clearReviews();
    await render(<ReviewQueueView />);
    expect(title()).toBe("Review queue · 0");
    expect(
      screen.getByText("The queue is clear. Flagged records will appear here."),
    ).toBeOnTheScreen();
  });
});
