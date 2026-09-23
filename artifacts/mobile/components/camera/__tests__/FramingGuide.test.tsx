import { render, screen } from "@testing-library/react-native";
import { FramingGuide } from "../FramingGuide";

describe("FramingGuide", () => {
  it("gives the per-category framing hint once locked", async () => {
    await render(<FramingGuide category="energy" locked />);
    expect(screen.getByText("Fit the whole pole, top to base")).toBeTruthy();
  });

  it("asks for open sky until the GPS locks", async () => {
    await render(<FramingGuide category="water" locked={false} />);
    expect(
      screen.getByText("Step into open sky, away from walls and trees"),
    ).toBeTruthy();
  });
});
