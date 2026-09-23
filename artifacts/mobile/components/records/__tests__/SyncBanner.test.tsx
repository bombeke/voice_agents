import { fireEvent, render, screen } from "@testing-library/react-native";
import { SyncBanner } from "../SyncBanner";

const props = {
  pending: 3,
  failed: 0,
  online: true,
  syncing: false,
  onSync: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("SyncBanner", () => {
  it("shows the queue size and syncs on tap", async () => {
    await render(<SyncBanner {...props} />);
    expect(screen.getByText("3 records waiting to upload")).toBeOnTheScreen();
    expect(screen.getByText("Photos upload on Wi-Fi")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sync now" }));
    expect(props.onSync).toHaveBeenCalled();
  });

  it("says when there is no network, and uses the singular", async () => {
    await render(<SyncBanner {...props} pending={1} online={false} />);
    expect(screen.getByText("1 record waiting to upload")).toBeOnTheScreen();
    expect(
      screen.getByText("No network · photos upload on Wi-Fi"),
    ).toBeOnTheScreen();
  });

  it("offers a retry for failed uploads", async () => {
    await render(<SyncBanner {...props} failed={2} />);
    expect(
      screen.getByText("2 failed to upload · tap Sync now to retry"),
    ).toBeOnTheScreen();
  });

  it("disables Sync now while uploading", async () => {
    await render(<SyncBanner {...props} failed={2} syncing />);
    expect(screen.getByText("Uploading…")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeDisabled();
  });

  it("hides once everything is synced", async () => {
    await render(<SyncBanner {...props} pending={0} />);
    expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();
  });
});
