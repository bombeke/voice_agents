import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
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

  it("renders rich label content while keeping the plain accessible name", async () => {
    const onCheckedChange = jest.fn();
    const onLink = jest.fn();
    await render(
      <Checkbox
        checked={false}
        label="I agree to the terms"
        onCheckedChange={onCheckedChange}
      >
        I agree to the{" "}
        <Text accessibilityRole="link" onPress={onLink}>
          terms
        </Text>
      </Checkbox>,
    );

    expect(
      screen.getByRole("checkbox", { name: "I agree to the terms" }),
    ).not.toBeChecked();
    await fireEvent.press(screen.getByRole("link", { name: "terms" }));
    expect(onLink).toHaveBeenCalled();
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
