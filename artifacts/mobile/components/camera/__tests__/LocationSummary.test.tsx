import type { CaptureLocation } from "@/types/Capture";
import { render, screen } from "@testing-library/react-native";
import { LocationSummary } from "../LocationSummary";

const LOCATION: CaptureLocation = {
  latitude: 0.313612,
  longitude: 32.581104,
  accuracy: 2.8,
  altitude: 1203.4,
  satellites: 18,
  flags: [],
};

describe("LocationSummary", () => {
  it("shows the coordinates, elevation, accuracy and satellites", async () => {
    await render(<LocationSummary location={LOCATION} />);
    expect(screen.getByText("0.3136120")).toBeTruthy();
    expect(screen.getByText("32.5811040")).toBeTruthy();
    expect(screen.getByText(/1,?203\.4 m/)).toBeTruthy();
    expect(screen.getByText("±2.8 m · 18 sats")).toBeTruthy();
  });

  it("marks values the receiver didn't report and unverified drafts", async () => {
    await render(
      <LocationSummary
        location={{
          ...LOCATION,
          accuracy: 6.1,
          altitude: null,
          satellites: null,
          flags: ["gps_unverified"],
        }}
      />,
    );
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("±6.1 m")).toBeTruthy();
    expect(
      screen.getByText("Location not verified: saved for supervisor review."),
    ).toBeTruthy();
  });
});
