import type { CaptureSummary } from "@/types/Capture";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { LastCapturedCard } from "../LastCapturedCard";

const capture: CaptureSummary = {
  id: "c1",
  category: "energy",
  title: "Concrete pole · inclined 7°",
  capturedAt: new Date(2026, 8, 23, 10, 14).toISOString(),
  accuracyM: 2.8,
  syncStatus: "pending",
  flagged: false,
};

describe("LastCapturedCard", () => {
  it("shows the newest capture and opens it", async () => {
    const onPress = jest.fn();
    await render(<LastCapturedCard capture={capture} onPress={onPress} />);
    expect(
      screen.getByText("10:14 · ±2.8 m · waiting to sync"),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: /Concrete pole · inclined 7°/ }),
    );
    expect(onPress).toHaveBeenCalledWith(capture);
  });

  it("prompts to start when nothing has been captured", async () => {
    await render(<LastCapturedCard onPress={jest.fn()} />);
    expect(screen.getByText(/Nothing captured yet/)).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
