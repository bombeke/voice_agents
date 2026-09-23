import { fireEvent, render, screen } from "@testing-library/react-native";
import { CategoryGrid } from "../CategoryGrid";

describe("CategoryGrid", () => {
  it("shows the four categories with the current one checked", async () => {
    const onChange = jest.fn();
    await render(
      <CategoryGrid label="Category" value="energy" onChange={onChange} />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(
      screen.getByRole("radio", { name: "Energy & Power", checked: true }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("radio", { name: "Water & Sanitation" }),
    );
    expect(onChange).toHaveBeenCalledWith("water");
  });

  it("can start with nothing chosen and be disabled", async () => {
    await render(
      <CategoryGrid
        label="Category"
        value={null}
        onChange={jest.fn()}
        disabled
      />,
    );
    expect(screen.queryByRole("radio", { checked: true })).toBeNull();
    expect(screen.getByRole("radio", { name: "Telecom" })).toBeDisabled();
  });
});
