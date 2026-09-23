import { fireEvent, render, screen } from "@testing-library/react-native";
import { CaptureStepHeader } from "../CaptureStepHeader";

describe("CaptureStepHeader", () => {
  it("shows the title, subtitle and step, and goes back", async () => {
    const onBack = jest.fn();
    await render(
      <CaptureStepHeader
        title="Tag this asset"
        subtitle="Pole · concrete · 2 detections kept"
        step="Step 3 of 3"
        backLabel="Back to review"
        onBack={onBack}
      />,
    );
    expect(screen.getByRole("header", { name: "Tag this asset" })).toBeTruthy();
    expect(
      screen.getByText("Pole · concrete · 2 detections kept"),
    ).toBeTruthy();
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Back to review" }),
    );
    expect(onBack).toHaveBeenCalled();
  });
});
