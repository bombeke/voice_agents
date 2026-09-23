import { fireEvent, render, screen } from "@testing-library/react-native";
import { Checkbox } from "../Checkbox";

describe("Checkbox", () => {
  it("exposes a labelled checkbox with its state", async () => {
    await render(
      <Checkbox checked label="Keep me signed in" onCheckedChange={() => {}} />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Keep me signed in" }),
    ).toBeChecked();
  });

  it("requests the opposite value on press", async () => {
    const onCheckedChange = jest.fn();
    await render(
      <Checkbox
        checked={false}
        label="Keep me signed in"
        onCheckedChange={onCheckedChange}
      />,
    );
    await fireEvent.press(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("ignores presses when disabled", async () => {
    const onCheckedChange = jest.fn();
    await render(
      <Checkbox
        checked={false}
        disabled
        label="Keep me signed in"
        onCheckedChange={onCheckedChange}
      />,
    );
    await fireEvent.press(screen.getByRole("checkbox"));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
