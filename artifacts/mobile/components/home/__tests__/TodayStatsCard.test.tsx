import { render, screen } from "@testing-library/react-native";
import { TodayStatsCard } from "../TodayStatsCard";

const stats = { capturedToday: 14, synced: 11, flagged: 1, pending: 3 };

describe("TodayStatsCard", () => {
  it("shows today's counts and the GNSS bands", async () => {
    await render(
      <TodayStatsCard stats={stats} gnss={{ bands: "L1+L5", ok: true }} />,
    );
    expect(screen.getByLabelText("Captured today: 14")).toBeOnTheScreen();
    expect(screen.getByLabelText("Synced: 11")).toBeOnTheScreen();
    expect(screen.getByLabelText("Flagged: 1")).toBeOnTheScreen();
    expect(screen.getByLabelText("GNSS: L1+L5")).toBeOnTheScreen();
  });

  it("says there is no fix before the first GNSS reading", async () => {
    await render(<TodayStatsCard stats={stats} gnss={null} />);
    expect(screen.getByLabelText("GNSS: No fix")).toBeOnTheScreen();
  });
});
