import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { Button } from "../Button";

describe("Button", () => {
  it("renders a string child as its label", async () => {
    await render(<Button>Save record</Button>);
    expect(
      screen.getByRole("button", { name: "Save record" }),
    ).toBeOnTheScreen();
  });

  it("renders custom children as-is", async () => {
    await render(
      <Button>
        <Text>Custom</Text>
      </Button>,
    );
    expect(screen.getByText("Custom")).toBeOnTheScreen();
  });

  it("calls onPress", async () => {
    const onPress = jest.fn();
    await render(<Button onPress={onPress}>Go</Button>);
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is disabled and ignores presses when disabled", async () => {
    const onPress = jest.fn();
    await render(
      <Button onPress={onPress} disabled>
        Go
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders the outline, danger and small variants as buttons", async () => {
    await render(
      <>
        <Button variant="outline" size="sm">
          Download
        </Button>
        <Button variant="danger">Sign out</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Download" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeOnTheScreen();
  });
});
