import type { GnssFix } from "@/types/Capture";
import { render, screen } from "@testing-library/react-native";
import { CaptureStatusStrip, receiverLine } from "../CaptureStatusStrip";

const fix: GnssFix = {
  latitude: 0.3136,
  longitude: 32.5811,
  altitude: null,
  accuracy: 2.8,
  altitudeAccuracy: null,
  timestamp: 0,
  mocked: false,
  satellites: 18,
  fixType: "3D",
  bands: "L1+L5",
};

const props = {
  status: "ready" as const,
  accuracy: 2.8,
  latest: fix,
  heading: 142,
  error: null,
  tracking: "normal" as const,
  rangeM: 12.4,
  model: "YOLO26n",
  inferenceMs: 31,
};

describe("receiverLine", () => {
  it("lists what the receiver reports", () => {
    expect(receiverLine(fix, 142)).toBe("18 sats · 3D · L1+L5 · 142° SE");
    expect(receiverLine(null, null)).toBe("");
  });
});

describe("CaptureStatusStrip", () => {
  it("shows accuracy, AR tracking, range and model speed", async () => {
    await render(<CaptureStatusStrip {...props} />);
    expect(screen.getByText("± 2.8 m")).toBeTruthy();
    expect(screen.getByText("AR tracked")).toBeTruthy();
    expect(screen.getByText("12.4 m")).toBeTruthy();
    expect(screen.getByText("YOLO26n 31 ms")).toBeTruthy();
    expect(
      screen.getByRole("summary", {
        name: "Location locked. ± 2.8 m. 18 sats · 3D · L1+L5 · 142° SE. AR tracked",
      }),
    ).toBeTruthy();
  });

  it("says when AR is still mapping or missing, and leaves out an unknown range", async () => {
    await render(
      <CaptureStatusStrip
        {...props}
        tracking="limited"
        rangeM={null}
        inferenceMs={null}
      />,
    );
    expect(screen.getByText("AR mapping…")).toBeTruthy();
    expect(screen.queryByText("12.4 m")).toBeNull();
    expect(screen.getByText("YOLO26n")).toBeTruthy();

    await render(
      <CaptureStatusStrip {...props} tracking={null} accuracy={null} />,
    );
    expect(screen.getByText("No AR")).toBeTruthy();
    expect(screen.getByText("± — m")).toBeTruthy();
  });
});
