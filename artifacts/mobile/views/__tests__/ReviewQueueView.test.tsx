import { fakeCaptures } from "@/mocks/captures";
import { fakeReviewQueue } from "@/mocks/reviews";
import { captures, reviewItems } from "@/db/schema";
import { seedCaptures, setupTestDatabase } from "@/db/testing/TestDb";
import { isOnline$ } from "@/services/storage/NetworkState";
import {
  applyReviewBatch,
  replaceMyReviews,
} from "@/services/storage/ReviewStore";
import type { ReviewItem } from "@/types/Review";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { eq } from "drizzle-orm";
import { ReviewQueueView } from "../ReviewQueueView";

const mockRouter = { push: jest.fn() };
const mockDownload = jest.fn(async () => ({ ok: true, added: 3 }));
jest.mock("@/services/sync/ReviewSync", () => ({
  downloadReviewBatch: () => mockDownload(),
}));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

const CAPTURES = fakeCaptures();

const getDb = setupTestDatabase();

/** Replaces the downloaded queue (a batch of these items). */
async function setQueue(items: ReviewItem[]) {
  await getDb().write((tx) => tx.delete(reviewItems));
  await applyReviewBatch({ batchId: "b1", items, records: [] });
}

beforeEach(async () => {
  mockRouter.push.mockClear();
  mockDownload.mockClear();
  isOnline$.set(true);
  await seedCaptures(getDb(), CAPTURES);
  await setQueue(fakeReviewQueue(CAPTURES));
});

const title = () => screen.getByRole("header").props.children;
/** Waits until the title reads `text` (the queue is read from the database). */
const titleIs = (text: string) => waitFor(() => expect(title()).toBe(text));

describe("ReviewQueueView", () => {
  it("shows the supervisor's queue with its count", async () => {
    await render(<ReviewQueueView canDecide />);
    await titleIs("Review queue · 4");
    expect(screen.getByText("Supervisor")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "All reasons" })).toBeSelected();
    for (const name of ["Culvert · pipe", "Public tap", "Transformer"]) {
      expect(screen.getByText(name)).toBeOnTheScreen();
    }
  });

  it("filters by reason but keeps the total in the title", async () => {
    await render(<ReviewQueueView canDecide />);
    await titleIs("Review queue · 4");
    await fireEvent.press(screen.getByRole("tab", { name: "GPS" }));
    await waitFor(() =>
      expect(screen.queryByText("Culvert · pipe")).not.toBeOnTheScreen(),
    );
    expect(screen.getByText("Public tap")).toBeOnTheScreen();
    expect(title()).toBe("Review queue · 4");
  });

  it("removes a card once it is approved or rejected", async () => {
    await render(<ReviewQueueView canDecide />);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Approve Culvert · pipe" }),
    );
    await titleIs("Review queue · 3");
    expect(screen.queryByText("Culvert · pipe")).not.toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole("button", { name: "Reject Public tap" }),
    );
    await fireEvent.press(screen.getByRole("radio", { name: "Bad location" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm reject" }),
    );
    await titleIs("Review queue · 2");
    expect(screen.queryByText("Public tap")).not.toBeOnTheScreen();
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
    await setQueue(fakeReviewQueue(CAPTURES).slice(0, 2));
    await render(<ReviewQueueView canDecide />);
    await titleIs("Review queue · 2");
    await fireEvent.press(screen.getByRole("tab", { name: "Duplicates" }));
    expect(
      await screen.findByText("No records waiting for this reason."),
    ).toBeOnTheScreen();
  });

  it("says when the queue is clear", async () => {
    await setQueue([]);
    await render(<ReviewQueueView canDecide />);
    await titleIs("Review queue · 0");
    expect(
      screen.getByText("The queue is clear. Download a batch to review more."),
    ).toBeOnTheScreen();
  });

  it("downloads the next batch when online, and not offline", async () => {
    await render(<ReviewQueueView canDecide />);
    expect(
      await screen.findByText(/^Batch of 4 · downloaded today/),
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
      await screen.findByRole("button", { name: "Approve Culvert · pipe" }),
    );
    expect(
      await screen.findByText("1 decision waiting to upload"),
    ).toBeOnTheScreen();
  });

  it("switches a supervisor to their own records", async () => {
    await render(<ReviewQueueView canDecide />);
    await fireEvent.press(screen.getByRole("tab", { name: "My records" }));
    await titleIs("My records in review · 1");
    expect(
      screen.getByRole("button", { name: /Culvert · pipe.*Waiting/ }),
    ).toBeOnTheScreen();
  });

  it("shows an enumerator only their own records and the verdicts", async () => {
    const culvert = CAPTURES.find((c) => c.title === "Culvert · pipe")!;
    await replaceMyReviews([
      { captureId: culvert.id, state: "rejected", rejectReason: "poor_photo" },
    ]);
    await render(<ReviewQueueView canDecide={false} />);
    await titleIs("My records in review · 1");
    expect(screen.getByText("Review")).toBeOnTheScreen();
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
    await getDb().write((tx) =>
      tx
        .update(captures)
        .set({ flagged: false })
        .where(eq(captures.scope, "mine")),
    );
    await render(<ReviewQueueView canDecide={false} />);
    expect(
      await screen.findByText(
        "None of your records are waiting for a supervisor.",
      ),
    ).toBeOnTheScreen();
  });
});
