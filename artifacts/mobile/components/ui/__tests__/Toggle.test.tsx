import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Toggle } from "../Toggle";

// The knob animates on every value change; run it to completion inside act.
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

describe("Toggle", () => {
  it("exposes a labelled switch with its state", async () => {
    await render(
      <Toggle value accessibilityLabel="Wi-Fi only" onValueChange={() => {}} />,
    );
    expect(screen.getByRole("switch", { name: "Wi-Fi only" })).toBeChecked();
  });

  it("requests the opposite value on press", async () => {
    const onValueChange = jest.fn();
    await render(
      <Toggle
        value={false}
        accessibilityLabel="Wi-Fi only"
        onValueChange={onValueChange}
      />,
    );
    await fireEvent.press(screen.getByRole("switch"));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it("ignores presses when disabled", async () => {
    const onValueChange = jest.fn();
    await render(
      <Toggle
        value={false}
        disabled
        accessibilityLabel="Wi-Fi only"
        onValueChange={onValueChange}
      />,
    );
    await fireEvent.press(screen.getByRole("switch"));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
