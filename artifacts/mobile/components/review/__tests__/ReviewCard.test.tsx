import type { ReviewItem } from "@/types/Review";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ReviewCard } from "../ReviewCard";

const today = (hour: number, minute = 0) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const ITEM: ReviewItem = {
  id: "r1",
  captureId: "c1",
  category: "roads",
  title: "Culvert · pipe",
  enumerator: "Enumerator 04",
  capturedAt: today(9, 20),
  reason: { kind: "low_confidence", confidence: 0.52 },
};

async function renderCard(item: ReviewItem = ITEM) {
  const handlers = {
    onOpen: jest.fn(),
    onApprove: jest.fn(),
    onReject: jest.fn(),
  };
  await render(<ReviewCard item={item} {...handlers} />);
  return handlers;
}

describe("ReviewCard", () => {
  it("shows the code, name, who and when, and why it was flagged", async () => {
    await renderCard();
    expect(screen.getByText("RD")).toBeOnTheScreen();
    expect(screen.getByText("Culvert · pipe")).toBeOnTheScreen();
    expect(screen.getByText("Enumerator 04 · today 09:20")).toBeOnTheScreen();
    expect(screen.getByText("Low AI confidence (0.52)")).toBeOnTheScreen();
  });

  it("opens the record from its header", async () => {
    const { onOpen } = await renderCard();
    await fireEvent.press(
      screen.getByRole("button", { name: /Culvert · pipe.*Open record/ }),
    );
    expect(onOpen).toHaveBeenCalledWith(ITEM);
  });

  it("isn't a dead button when there's no record on this device", async () => {
    await renderCard({ ...ITEM, captureId: undefined });
    expect(
      screen.queryByRole("button", { name: /Open record/ }),
    ).not.toBeOnTheScreen();
  });

  it("approves in one tap", async () => {
    const { onApprove, onReject } = await renderCard();
    await fireEvent.press(
      screen.getByRole("button", { name: "Approve Culvert · pipe" }),
    );
    expect(onApprove).toHaveBeenCalledWith(ITEM);
    expect(onReject).not.toHaveBeenCalled();
  });

  it("asks for a reason before rejecting", async () => {
    const { onReject } = await renderCard();
    await fireEvent.press(
      screen.getByRole("button", { name: "Reject Culvert · pipe" }),
    );
    const confirm = screen.getByRole("button", { name: "Confirm reject" });
    expect(confirm).toBeDisabled();

    await fireEvent.press(screen.getByRole("radio", { name: "Poor photo" }));
    expect(screen.getByRole("radio", { name: "Poor photo" })).toBeChecked();
    expect(confirm).toBeEnabled();
    await fireEvent.press(confirm);
    expect(onReject).toHaveBeenCalledWith(ITEM, "poor_photo");
  });

  it("cancels a rejection back to Reject / Approve", async () => {
    const { onReject } = await renderCard();
    await fireEvent.press(
      screen.getByRole("button", { name: "Reject Culvert · pipe" }),
    );
    await fireEvent.press(screen.getByRole("radio", { name: "Other" }));
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Approve Culvert · pipe" }),
    ).toBeOnTheScreen();

    // The next attempt starts without the old choice.
    await fireEvent.press(
      screen.getByRole("button", { name: "Reject Culvert · pipe" }),
    );
    expect(screen.getByRole("radio", { name: "Other" })).not.toBeChecked();
    expect(onReject).not.toHaveBeenCalled();
  });
});
