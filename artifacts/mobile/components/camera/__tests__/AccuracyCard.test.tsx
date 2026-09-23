import type { GnssFix } from "@/types/Capture";
import { render, screen } from "@testing-library/react-native";
import { AccuracyCard, receiverLine } from "../AccuracyCard";

const fix: GnssFix = {
  latitude: 0,
  longitude: 0,
  altitude: null,
  accuracy: 2.8,
  altitudeAccuracy: null,
  timestamp: 0,
  mocked: false,
  satellites: 18,
  fixType: "3D",
  bands: "L1+L5",
};

describe("receiverLine", () => {
  it("joins the parts the receiver reports", () => {
    expect(receiverLine(fix, 142)).toBe("18 sats · 3D · L1+L5 · 142° SE");
  });

  it("leaves out what a phone doesn't report", () => {
    expect(
      receiverLine(
        { ...fix, satellites: null, fixType: null, bands: null },
        null,
      ),
    ).toBe("");
  });
});

describe("AccuracyCard", () => {
  it("shows a locked fix with three stable fixes", async () => {
    await render(
      <AccuracyCard
        status="ready"
        accuracy={2.8}
        streak={3}
        latest={fix}
        heading={142}
        error={null}
      />,
    );
    expect(screen.getByText("±2.8")).toBeTruthy();
    expect(screen.getByText("Location locked")).toBeTruthy();
    expect(screen.getByText("18 sats · 3D · L1+L5 · 142° SE")).toBeTruthy();
    expect(screen.getByLabelText("3 of 3 stable fixes")).toBeTruthy();
  });

  it("shows confirming progress", async () => {
    await render(
      <AccuracyCard
        status="confirming"
        accuracy={3.6}
        streak={1}
        latest={fix}
        heading={null}
        error={null}
      />,
    );
    expect(screen.getByText("Confirming fix…")).toBeTruthy();
    expect(screen.getByLabelText("1 of 3 stable fixes")).toBeTruthy();
  });

  it("shows a dash before the first fix", async () => {
    await render(
      <AccuracyCard
        status="acquiring"
        accuracy={null}
        streak={0}
        latest={null}
        heading={null}
        error={null}
      />,
    );
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("Acquiring accurate fix…")).toBeTruthy();
  });

  it("shows the error when location fails", async () => {
    await render(
      <AccuracyCard
        status="error"
        accuracy={null}
        streak={0}
        latest={null}
        heading={null}
        error="GPS is off"
      />,
    );
    expect(screen.getByText("Location unavailable")).toBeTruthy();
    expect(screen.getByText("GPS is off")).toBeTruthy();
  });
});
