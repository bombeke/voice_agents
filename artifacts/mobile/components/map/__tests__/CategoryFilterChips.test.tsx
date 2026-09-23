import { fireEvent, render, screen } from "@testing-library/react-native";
import { CategoryFilterChips } from "../CategoryFilterChips";

describe("CategoryFilterChips", () => {
  it("checks the current filter and picks another", async () => {
    const onChange = jest.fn();
    await render(<CategoryFilterChips value="energy" onChange={onChange} />);

    for (const name of ["All", "Energy", "Water", "Telecom", "Roads"]) {
      expect(screen.getByRole("radio", { name })).toBeOnTheScreen();
    }
    expect(
      screen.getByRole("radio", { name: "Energy", checked: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("radio", { name: "All", checked: false }),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("radio", { name: "Water" }));
    expect(onChange).toHaveBeenCalledWith("water");
  });
});
