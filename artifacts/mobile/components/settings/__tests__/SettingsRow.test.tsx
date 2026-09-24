import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SettingsRow } from "../SettingsRow";

// Toggle rows animate their knob; run it to completion inside act.
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

describe("SettingsRow", () => {
  it("toggles a switch named after the row", async () => {
    const onChange = jest.fn();
    await render(
      <SettingsRow
        label="Sync in the background"
        trailing={{ kind: "toggle", value: true, onChange }}
      />,
    );
    const toggle = screen.getByRole("switch", {
      name: "Sync in the background",
    });
    expect(toggle).toBeChecked();
    await fireEvent.press(toggle);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("opens a nav row, named with its value", async () => {
    const onPress = jest.fn();
    await render(
      <SettingsRow
        label="Language"
        trailing={{ kind: "nav", value: "English", onPress }}
      />,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Language: English" }),
    );
    expect(onPress).toHaveBeenCalled();
  });

  it("disables a nav row with nowhere to go", async () => {
    await render(
      <SettingsRow
        label="Signed-in devices"
        trailing={{ kind: "nav", value: "2" }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Signed-in devices: 2" }),
    ).toBeDisabled();
  });

  it("shows a read-only value and its hint", async () => {
    await render(
      <SettingsRow
        label="On-device model"
        hint="Runs offline"
        trailing={{ kind: "value", value: "det-v1.3.0" }}
      />,
    );
    expect(screen.getByText("det-v1.3.0")).toBeOnTheScreen();
    expect(screen.getByText("Runs offline")).toBeOnTheScreen();
  });

  it("marks an admin-set value as locked", async () => {
    await render(
      <SettingsRow
        label="GPS accuracy gate"
        trailing={{ kind: "locked", value: "< 4.0 m" }}
      />,
    );
    expect(screen.getByText("< 4.0 m")).toBeOnTheScreen();
    expect(
      screen.getByRole("image", { name: "Set by administrator" }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });

  it("runs its action unless disabled", async () => {
    const onPress = jest.fn();
    const { rerender } = await render(
      <SettingsRow
        label="3 records waiting"
        trailing={{ kind: "action", label: "Sync now", onPress }}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Sync now" }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(
      <SettingsRow
        label="3 records waiting"
        trailing={{
          kind: "action",
          label: "Sync now",
          onPress,
          disabled: true,
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Sync now" })).toBeDisabled();
  });

  it("can be a plain statement", async () => {
    await render(<SettingsRow label="Everything is synced" />);
    expect(screen.getByText("Everything is synced")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });
});
