import type { MyReview } from "@/helpers/reviewQueue";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MyReviewRow } from "../MyReviewRow";

const review = (status: Partial<MyReview["status"]> = {}): MyReview => ({
  capture: {
    id: "fake-capture-4",
    category: "roads",
    title: "Culvert · pipe",
    detail: "partly blocked",
    capturedAt: new Date(2026, 8, 24, 9, 20).toISOString(),
    accuracyM: 3.6,
    syncStatus: "synced",
    flagged: true,
  },
  status: { captureId: "fake-capture-4", state: "waiting", ...status },
});

describe("MyReviewRow", () => {
  it("shows a record waiting for a supervisor", async () => {
    await render(<MyReviewRow review={review()} onPress={() => {}} />);
    expect(
      screen.getByRole("button", {
        name: "Culvert · pipe, 09:20 · ±3.6 m · partly blocked, Waiting. Open record",
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Waiting for a supervisor")).toBeOnTheScreen();
  });

  it("says why a record was rejected", async () => {
    await render(
      <MyReviewRow
        review={review({ state: "rejected", rejectReason: "bad_location" })}
        onPress={() => {}}
      />,
    );
    expect(screen.getByText("Rejected")).toBeOnTheScreen();
    expect(
      screen.getByText("Rejected: Bad location. Edit the record to fix it."),
    ).toBeOnTheScreen();
  });

  it("shows an approval without a note, and opens the record", async () => {
    const onPress = jest.fn();
    const approved = review({ state: "approved" });
    await render(<MyReviewRow review={approved} onPress={onPress} />);
    expect(screen.getByText("Approved")).toBeOnTheScreen();
    expect(screen.queryByText("Waiting for a supervisor")).toBeNull();
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledWith(approved);
  });
});
