import { fireEvent, render, screen } from "@testing-library/react-native";
import { HomeHeader } from "../HomeHeader";

const onPendingPress = jest.fn();
const onProfilePress = jest.fn();

const renderHeader = (pendingCount: number, org?: string) =>
  render(
    <HomeHeader
      org={org}
      pendingCount={pendingCount}
      onPendingPress={onPendingPress}
      onProfilePress={onProfilePress}
    />,
  );

beforeEach(() => jest.clearAllMocks());

describe("HomeHeader", () => {
  it("shows the project and screen title", async () => {
    await renderHeader(3, "Pilot Zone 3");
    expect(screen.getByText("IIP · Pilot Zone 3")).toBeOnTheScreen();
    expect(
      screen.getByRole("header", { name: "Field capture" }),
    ).toBeOnTheScreen();
  });

  it("opens records from the pending pill", async () => {
    await renderHeader(3);
    expect(screen.getByText("3 pending")).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: /3 records waiting to sync/ }),
    );
    expect(onPendingPress).toHaveBeenCalledTimes(1);
  });

  it("hides the pill when everything is synced", async () => {
    await renderHeader(0);
    expect(screen.queryByText(/pending/)).toBeNull();
    expect(screen.getByText("IIP")).toBeOnTheScreen();
  });

  it("opens the profile", async () => {
    await renderHeader(0);
    await fireEvent.press(
      screen.getByRole("button", { name: "Profile and settings" }),
    );
    expect(onProfilePress).toHaveBeenCalledTimes(1);
  });
});
