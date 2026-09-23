import { render, screen } from "@testing-library/react-native";
import { RecordHeader } from "../RecordHeader";

const RECORD = {
  category: "energy" as const,
  title: "Concrete pole",
  assetId: "EP-00412",
  capturedAt: new Date(2026, 8, 22, 10, 14).toISOString(),
};

describe("RecordHeader", () => {
  it("shows the category, sync state, name and capture line", async () => {
    await render(
      <RecordHeader record={RECORD} syncStatus="pending" flagged={false} />,
    );
    expect(screen.getByText("Energy & Power")).toBeOnTheScreen();
    expect(screen.getByText("Waiting to sync")).toBeOnTheScreen();
    expect(
      screen.getByRole("header", { name: "Concrete pole" }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/^EP-00412 · captured 22 Sept? 2026, 10:14$/),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Flagged for review")).toBeNull();
  });

  it("adds a flag for a record routed to a supervisor", async () => {
    await render(<RecordHeader record={RECORD} syncStatus="failed" flagged />);
    expect(screen.getByText("Sync failed")).toBeOnTheScreen();
    expect(screen.getByText("Flagged for review")).toBeOnTheScreen();
  });
});
