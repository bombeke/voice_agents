import { fireEvent, render, screen } from "@testing-library/react-native";
import { Chip } from "../Chip";

describe("Chip", () => {
  it("renders a static label", async () => {
    await render(<Chip label="AI · high" tone="success" />);
    expect(screen.getByText("AI · high")).toBeOnTheScreen();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("is a checkbox when selectable", async () => {
    const onPress = jest.fn();
    await render(<Chip label="Leaning" onPress={onPress} selected />);
    const chip = screen.getByRole("checkbox", { name: "Leaning" });
    expect(chip).toBeChecked();
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("reports unselected state", async () => {
    await render(<Chip label="Rot" onPress={() => {}} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("ignores presses when disabled", async () => {
    const onPress = jest.fn();
    await render(<Chip label="Rot" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole("checkbox"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("takes a single-select role", async () => {
    await render(<Chip label="GPS" role="tab" onPress={() => {}} selected />);
    expect(screen.getByRole("tab", { name: "GPS" })).toBeSelected();
    await render(<Chip label="Other" role="radio" onPress={() => {}} />);
    expect(screen.getByRole("radio", { name: "Other" })).not.toBeChecked();
  });
});
