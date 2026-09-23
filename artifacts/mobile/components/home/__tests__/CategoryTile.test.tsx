import { fireEvent, render, screen } from "@testing-library/react-native";
import { CategoryTile } from "../CategoryTile";

describe("CategoryTile", () => {
  it("names the category and describes what it covers", async () => {
    await render(<CategoryTile category="water" onPress={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: "Water & Sanitation" }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Boreholes, taps, wells, tanks, toilets"),
    ).toBeOnTheScreen();
  });

  it("passes its category to the press handler", async () => {
    const onPress = jest.fn();
    await render(<CategoryTile category="telecom" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Telecom" }));
    expect(onPress).toHaveBeenCalledWith("telecom");
  });
});
