import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "../Card";

describe("Card", () => {
  it("renders children without being pressable", async () => {
    await render(
      <Card>
        <Text>Pole P-00933</Text>
      </Card>,
    );
    expect(screen.getByText("Pole P-00933")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("becomes a button when onPress is set", async () => {
    const onPress = jest.fn();
    await render(
      <Card onPress={onPress} accessibilityLabel="Open record">
        <Text>Pole P-00933</Text>
      </Card>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Open record" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
