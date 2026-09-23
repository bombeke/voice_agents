import { render, screen } from "@testing-library/react-native";
import { CaptureGateBanner } from "../CaptureGateBanner";

describe("CaptureGateBanner", () => {
  it("asks the user to wait for the first fix", async () => {
    await render(
      <CaptureGateBanner status="acquiring" accuracy={null} error={null} />,
    );
    expect(screen.getByText("Locating you…")).toBeOnTheScreen();
  });

  it("shows the accuracy while the fix is imprecise", async () => {
    await render(
      <CaptureGateBanner status="imprecise" accuracy={7.34} error={null} />,
    );
    expect(
      screen.getByText("GPS ±7.3 m — waiting for a better fix"),
    ).toBeOnTheScreen();
    expect(screen.getByText(/needs 4 m or better/)).toBeOnTheScreen();
  });

  it("confirms when capture is unlocked", async () => {
    await render(
      <CaptureGateBanner status="ready" accuracy={2.05} error={null} />,
    );
    expect(screen.getByText("GPS ±2.0 m — ready to capture")).toBeOnTheScreen();
  });

  it("surfaces location errors", async () => {
    await render(
      <CaptureGateBanner
        status="denied"
        accuracy={null}
        error="Permission denied"
      />,
    );
    expect(screen.getByText("Location unavailable")).toBeOnTheScreen();
    expect(screen.getByText("Permission denied")).toBeOnTheScreen();
  });

  it("explains an unreported accuracy", async () => {
    await render(
      <CaptureGateBanner status="unknown" accuracy={null} error={null} />,
    );
    expect(screen.getByText("GPS precision unknown")).toBeOnTheScreen();
  });
});
