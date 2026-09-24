import { fireEvent, render, screen } from "@testing-library/react-native";
import { ReviewFilterChips } from "../ReviewFilterChips";

describe("ReviewFilterChips", () => {
  it("shows every reason with the current one selected", async () => {
    await render(<ReviewFilterChips value="gps" onChange={() => {}} />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    for (const name of ["All reasons", "Low AI confidence", "Duplicates"]) {
      expect(screen.getByRole("tab", { name })).not.toBeSelected();
    }
    expect(screen.getByRole("tab", { name: "GPS" })).toBeSelected();
  });

  it("reports the picked reason", async () => {
    const onChange = jest.fn();
    await render(<ReviewFilterChips value="all" onChange={onChange} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Duplicates" }));
    expect(onChange).toHaveBeenCalledWith("duplicate");
  });
});
