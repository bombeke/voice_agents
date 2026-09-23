import { render, screen } from "@testing-library/react-native";
import { PasswordStrengthMeter } from "../PasswordStrengthMeter";

describe("PasswordStrengthMeter", () => {
  it("shows the rule before anything is typed", async () => {
    await render(<PasswordStrengthMeter password="" />);
    expect(
      screen.getByText("At least 10 characters with a number"),
    ).toBeOnTheScreen();
  });

  it.each([
    ["abc", "Weak"],
    ["abc123", "Fair"],
    ["fieldwork2026", "Strong"],
    ["Fieldwork2026", "Very strong"],
  ])("labels %p as %p", async (password, label) => {
    await render(<PasswordStrengthMeter password={password} />);
    expect(
      screen.getByText(`${label} · at least 10 characters with a number`),
    ).toBeOnTheScreen();
  });
});
