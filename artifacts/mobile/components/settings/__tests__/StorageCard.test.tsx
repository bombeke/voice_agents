import { storageBreakdown } from "@/helpers/settings";
import { fakeDeviceStatus } from "@/mocks/settings";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StorageCard } from "../StorageCard";

const { storage } = fakeDeviceStatus();

describe("StorageCard", () => {
  it("shows the total and each kind's size", async () => {
    await render(
      <StorageCard
        breakdown={storageBreakdown(storage)}
        clearableBytes={storage.syncedPhotosBytes}
        onClear={jest.fn()}
      />,
    );
    expect(screen.getByText("1.4 GB")).toBeOnTheScreen();
    expect(
      screen.getByRole("image", {
        name: "Photos 900 MB, map 312 MB, model 18 MB",
      }),
    ).toBeOnTheScreen();
  });

  it("clears synced photos, and only when there are some", async () => {
    const onClear = jest.fn();
    const { rerender } = await render(
      <StorageCard
        breakdown={storageBreakdown(storage)}
        clearableBytes={storage.syncedPhotosBytes}
        onClear={onClear}
      />,
    );
    const button = () =>
      screen.getByRole("button", { name: "Clear photos already synced" });
    await fireEvent.press(button());
    expect(onClear).toHaveBeenCalled();

    await rerender(
      <StorageCard
        breakdown={storageBreakdown(storage)}
        clearableBytes={0}
        onClear={onClear}
      />,
    );
    expect(button()).toBeDisabled();
  });
});
