import type {
  CaptureMetadata,
  DetectionPosition,
  ReviewDetection,
} from "@/types/Capture";
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

const POSITION: DetectionPosition = {
  latitude: 0.31358,
  longitude: 32.581061,
  altitude: 1188.5,
  distanceM: 12.4,
  slantDistanceM: 12.5,
  bearingDeg: 142,
  accuracyM: 3.1,
  projectionErrorM: 1.2,
  source: "ar_auto",
  hitType: "ExistingPlaneUsingExtent",
  arPoint: [7.6, 0, 9.8],
  rough: false,
};

const METADATA = {
  device: {
    latitude: 0.313612,
    longitude: 32.581104,
    altitude: 1190,
    accuracy: 2.8,
    altitudeAccuracy: null,
    heading: 142,
    pitchDeg: 0,
    rollDeg: 0,
  },
} as CaptureMetadata;

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

  it("shows the computed position and offers re-placing", async () => {
    const onReplace = jest.fn();
    await render(
      <DetectionCard
        detection={detection({ position: POSITION })}
        number={1}
        expanded
        metadata={METADATA}
        onReplace={onReplace}
        {...handlers}
      />,
    );
    expect(screen.getByText("Confidence 0.91 · 12.4 m away")).toBeTruthy();
    expect(screen.getByText("AR ray × ground plane")).toBeTruthy();
    expect(screen.getByText("0.3135800")).toBeTruthy();
    expect(screen.getByText("12.4 m · 142°")).toBeTruthy();
    expect(screen.getByText("±3.1 m")).toBeTruthy();
    expect(
      screen.getByText(
        "Device fix ±2.8 m plus projection ±1.2 m. The device stood at 0.313612°N, 32.581104°E.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("image", { name: "pole 12.4 m from you, bearing 142°" }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Re-place by tapping the base" }),
    );
    expect(onReplace).toHaveBeenCalled();
  });

  it("names an asset placed by tap", async () => {
    await render(
      <DetectionCard
        detection={detection({ manual: true, position: POSITION })}
        number={1}
        expanded
        {...handlers}
      />,
    );
    expect(screen.getByText("Placed by tap · 12.4 m away")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Re-place by tapping the base" }),
    ).toBeNull();
  });

  it("warns about a suggestion beyond the reliable AR range", async () => {
    await render(
      <DetectionCard
        detection={detection({
          decision: "suggested",
          confidence: 0.64,
          position: { ...POSITION, distanceM: 41.2, rough: true },
        })}
        number={2}
        expanded={false}
        {...handlers}
      />,
    );
    expect(screen.getByText("Pole (distant)")).toBeTruthy();
    expect(screen.getByText("Suggested · 0.64 · about 41 m away")).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Beyond reliable AR range (25 m). Accept it as a rough point, or walk closer and capture it on its own.",
    );
  });
});
