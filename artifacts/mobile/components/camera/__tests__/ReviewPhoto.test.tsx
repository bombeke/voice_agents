import type { DetectionPosition, ReviewDetection } from "@/types/Capture";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ReviewPhoto } from "../ReviewPhoto";

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

const detection = (
  trackId: number,
  decision: ReviewDetection["decision"],
  confidence: number,
): ReviewDetection => ({
  trackId,
  label: "pole",
  confidence,
  box: { xmin: 0.1, ymin: 0.1, xmax: 0.4, ymax: 0.9 },
  imageUri: "/tmp/1.jpg",
  decision,
  attributes: [],
});

async function renderLoaded(position?: DetectionPosition) {
  await render(
    <ReviewPhoto
      imageUri="/tmp/1.jpg"
      detections={[
        {
          detection: { ...detection(1, "accepted", 0.91), position },
          number: 1,
        },
        { detection: detection(2, "suggested", 0.64), number: 2 },
        { detection: detection(3, "rejected", 0.83), number: 3 },
      ]}
    />,
  );
  const photo = screen.getByRole("image");
  await fireEvent(photo, "layout", {
    nativeEvent: { layout: { width: 300, height: 300 } },
  });
  await fireEvent(photo, "load", {
    nativeEvent: { source: { width: 3000, height: 4000 } },
  });
}

describe("ReviewPhoto", () => {
  it("numbers the kept detections and leaves out rejected ones", async () => {
    await renderLoaded();
    expect(
      screen.getByRole("image", { name: "Photo with 2 detections" }),
    ).toBeTruthy();
    expect(screen.getByText("1 Pole · 0.91")).toBeTruthy();
    expect(screen.getByText("2 Pole · 0.64")).toBeTruthy();
    expect(screen.queryByText("3 Pole · 0.83")).toBeNull();
  });

  it("explains the solid and dashed boxes", async () => {
    await renderLoaded();
    expect(screen.getByText("Pre-accepted ≥ 0.70")).toBeTruthy();
    expect(screen.getByText("Suggested 0.40–0.70")).toBeTruthy();
  });

  it("marks ranged assets' ground points and distances", async () => {
    await renderLoaded(POSITION);
    expect(screen.getByText("12.4 m")).toBeTruthy();
    expect(screen.getByText("AR ground point")).toBeTruthy();
    expect(screen.queryByText("Suggested 0.40–0.70")).toBeNull();
  });
});
