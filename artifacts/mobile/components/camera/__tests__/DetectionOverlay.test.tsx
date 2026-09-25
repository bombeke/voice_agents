import type { Track } from "@/helpers/detectionTracker";
import { render, screen } from "@testing-library/react-native";
import { DetectionOverlay } from "../DetectionOverlay";

const track: Track = {
  trackId: 7,
  label: "pole",
  confidence: 0.9,
  box: { xmin: 10, ymin: 40, xmax: 60, ymax: 300 },
  vx: 0,
  vy: 0,
  age: 0,
  hits: 3,
};

const common = {
  tracks: {
    value: [
      track,
      { ...track, trackId: 8, label: "transformer", confidence: 0.5 },
    ],
  } as never,
  transform: { scale: 1, offsetX: 0, offsetY: 0 },
  viewport: { width: 390, height: 844 },
};

describe("DetectionOverlay", () => {
  it("labels accepted and suggested detections and counts them", async () => {
    await render(
      <DetectionOverlay
        {...common}
        labels={[
          { trackId: 7, label: "pole", confidence: 0.9, suggested: false },
          {
            trackId: 8,
            label: "transformer",
            confidence: 0.5,
            suggested: true,
          },
        ]}
      />,
    );
    expect(screen.getByLabelText("2 detected")).toBeTruthy();
    expect(screen.getByText("pole · 0.90")).toBeTruthy();
    expect(screen.getByText("transformer · 0.50")).toBeTruthy();
  });

  it("adds the inference time when it is known", async () => {
    await render(
      <DetectionOverlay
        {...common}
        inferenceMs={31}
        labels={[
          { trackId: 7, label: "pole", confidence: 0.91, suggested: false },
        ]}
      />,
    );
    expect(screen.getByText("pole · 0.91 · 31 ms")).toBeTruthy();
  });

  it("says when nothing is detected", async () => {
    await render(<DetectionOverlay {...common} labels={[]} />);
    expect(screen.getByLabelText("Nothing detected yet")).toBeTruthy();
  });
});
