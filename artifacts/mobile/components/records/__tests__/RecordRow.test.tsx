import type { CaptureSummary } from "@/types/Capture";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { RecordRow } from "../RecordRow";

const RECORD: CaptureSummary = {
  id: "r1",
  category: "roads",
  title: "Culvert · pipe",
  detail: "partly blocked",
  capturedAt: new Date(2026, 8, 23, 9, 20).toISOString(),
  accuracyM: 3.6,
  syncStatus: "synced",
  flagged: true,
};

describe("RecordRow", () => {
  it("shows the name, meta line and status", async () => {
    await render(<RecordRow record={RECORD} />);
    expect(screen.getByText("Culvert · pipe")).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        "Culvert · pipe, 09:20 · ±3.6 m · partly blocked, Flagged",
      ),
    ).toBeOnTheScreen();
    // Not a button until there is a record detail screen.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens the record when it can", async () => {
    const onPress = jest.fn();
    await render(<RecordRow record={RECORD} onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: /Culvert/ }));
    expect(onPress).toHaveBeenCalledWith(RECORD);
  });
});
