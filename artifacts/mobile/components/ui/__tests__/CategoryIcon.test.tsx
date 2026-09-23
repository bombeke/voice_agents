import { render, screen } from "@testing-library/react-native";
import { CategoryIcon } from "../CategoryIcon";

describe("CategoryIcon", () => {
  it.each([
    ["energy", "Energy & Power"],
    ["water", "Water & Sanitation"],
    ["telecom", "Telecom"],
    ["roads", "Roads & Drainage"],
  ] as const)("labels %s for screen readers", async (category, label) => {
    await render(<CategoryIcon category={category} />);
    expect(screen.getByRole("image", { name: label })).toBeOnTheScreen();
  });
});
