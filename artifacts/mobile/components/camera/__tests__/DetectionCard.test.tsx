import type { ReviewDetection } from "@/types/Capture";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { DetectionCard } from "../DetectionCard";

const detection = (over: Partial<ReviewDetection> = {}): ReviewDetection => ({
  trackId: 1,
  label: "pole",
  confidence: 0.91,
  box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 },
  imageUri: "/tmp/1.jpg",
  decision: "accepted",
  attributes: [
    { key: "material", value: "concrete", source: "ai", confidence: "high" },
    { key: "estimatedAge", value: "10-20", source: "ai", confidence: "low" },
  ],
  ...over,
});

const handlers = {
  onToggle: jest.fn(),
  onAccept: jest.fn(),
  onReject: jest.fn(),
  onUndo: jest.fn(),
  onEditAttribute: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("DetectionCard", () => {
  it("lists an accepted detection's attributes when expanded", async () => {
    await render(
      <DetectionCard
        detection={detection()}
        number={1}
        expanded
        {...handlers}
      />,
    );
    expect(screen.getByText("Pole")).toBeTruthy();
    expect(screen.getByText("Confidence 0.91")).toBeTruthy();
    expect(screen.getByText("Accepted")).toBeTruthy();
    expect(screen.getByText("Please check")).toBeTruthy();

    await fireEvent.press(
      screen.getByRole("button", { name: "Change estimated age" }),
    );
    expect(handlers.onEditAttribute).toHaveBeenCalledWith("estimatedAge");

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Hide 1 Pole attributes",
        expanded: true,
      }),
    );
    expect(handlers.onToggle).toHaveBeenCalled();
  });

  it("hides the attributes when collapsed", async () => {
    await render(
      <DetectionCard
        detection={detection()}
        number={3}
        expanded={false}
        {...handlers}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Show 3 Pole attributes",
        expanded: false,
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Material")).toBeNull();
  });

  it("asks for a decision on a suggestion", async () => {
    await render(
      <DetectionCard
        detection={detection({
          confidence: 0.64,
          decision: "suggested",
          attributes: [
            { key: "material", value: "wood", source: "ai", confidence: "low" },
          ],
        })}
        number={2}
        expanded
        {...handlers}
      />,
    );
    expect(
      screen.getByText("Suggested · confidence 0.64 · wood?"),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Not an asset" }));
    await fireEvent.press(screen.getByRole("button", { name: "Accept" }));
    expect(handlers.onReject).toHaveBeenCalled();
    expect(handlers.onAccept).toHaveBeenCalled();
  });

  it("lets a rejection be undone", async () => {
    await render(
      <DetectionCard
        detection={detection({ decision: "rejected" })}
        number={1}
        expanded
        {...handlers}
      />,
    );
    expect(screen.getByText("Not an asset · confidence 0.91")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Undo" }));
    expect(handlers.onUndo).toHaveBeenCalled();
  });
});
