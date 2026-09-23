import { fireEvent, render, screen } from "@testing-library/react-native";
import { RecordsHeader } from "../RecordsHeader";

describe("RecordsHeader", () => {
  it("opens the search", async () => {
    const onToggleSearch = jest.fn();
    await render(
      <RecordsHeader
        searchOpen={false}
        onToggleSearch={onToggleSearch}
        query=""
        onChangeQuery={jest.fn()}
      />,
    );
    expect(screen.getByRole("header", { name: "Records" })).toBeOnTheScreen();
    expect(
      screen.queryByLabelText("Search by name, ID or category"),
    ).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Search records" }),
    );
    expect(onToggleSearch).toHaveBeenCalled();
  });

  it("shows the field while open and reports typing", async () => {
    const onChangeQuery = jest.fn();
    await render(
      <RecordsHeader
        searchOpen
        onToggleSearch={jest.fn()}
        query=""
        onChangeQuery={onChangeQuery}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Close search" }),
    ).toBeOnTheScreen();
    await fireEvent.changeText(
      screen.getByPlaceholderText("Search by name, ID or category"),
      "pole",
    );
    expect(onChangeQuery).toHaveBeenCalledWith("pole");
  });
});
