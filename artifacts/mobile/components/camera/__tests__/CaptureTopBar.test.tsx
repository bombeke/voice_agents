import { fireEvent, render, screen } from "@testing-library/react-native";
import { CaptureTopBar } from "../CaptureTopBar";

describe("CaptureTopBar", () => {
  it("shows the category and wires close and flash", async () => {
    const onClose = jest.fn();
    const onToggleFlash = jest.fn();
    await render(
      <CaptureTopBar
        category="energy"
        flash={false}
        onClose={onClose}
        onToggleFlash={onToggleFlash}
      />,
    );
    expect(screen.getByText("Energy & Power")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Close camera" }));
    expect(onClose).toHaveBeenCalled();
    const flash = screen.getByRole("switch", { name: "Flash off" });
    expect(flash.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(flash);
    expect(onToggleFlash).toHaveBeenCalled();
  });

  it("names the AI pick when no category was chosen", async () => {
    await render(
      <CaptureTopBar
        category="auto"
        flash
        onClose={jest.fn()}
        onToggleFlash={jest.fn()}
      />,
    );
    expect(screen.getByText("AI picks category")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Flash on" })).toBeTruthy();
  });
});
