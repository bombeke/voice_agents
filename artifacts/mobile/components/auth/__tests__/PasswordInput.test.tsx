import { fireEvent, render, screen } from "@testing-library/react-native";
import { PasswordInput } from "../PasswordInput";

describe("PasswordInput", () => {
  it("hides the password until Show password is pressed", async () => {
    await render(<PasswordInput accessibilityLabel="Password" />);
    const field = screen.getByLabelText("Password");
    expect(field).toHaveProp("secureTextEntry", true);

    await fireEvent.press(
      screen.getByRole("button", { name: "Show password" }),
    );
    expect(field).toHaveProp("secureTextEntry", false);

    await fireEvent.press(
      screen.getByRole("button", { name: "Hide password" }),
    );
    expect(field).toHaveProp("secureTextEntry", true);
  });
});
