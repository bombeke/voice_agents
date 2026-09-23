import { fireEvent, render, screen } from "@testing-library/react-native";
import { SearchBar } from "../SearchBar";

const LABELS = {
  label: "Search assets or IDs",
  placeholder: "Search assets or IDs",
  clearLabel: "Clear search",
};

describe("SearchBar", () => {
  it("reports typing and has no clear button while empty", async () => {
    const onChangeText = jest.fn();
    await render(
      <SearchBar {...LABELS} value="" onChangeText={onChangeText} />,
    );
    await fireEvent.changeText(
      screen.getByLabelText("Search assets or IDs"),
      "EP-004",
    );
    expect(onChangeText).toHaveBeenCalledWith("EP-004");
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("clears the search", async () => {
    const onChangeText = jest.fn();
    await render(
      <SearchBar {...LABELS} value="pole" onChangeText={onChangeText} />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Clear search" }));
    expect(onChangeText).toHaveBeenCalledWith("");
  });
});
