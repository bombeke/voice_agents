import { fireEvent, render, screen } from "@testing-library/react-native";
import { TextLink } from "../TextLink";

describe("TextLink", () => {
  it("is a named link that calls onPress", async () => {
    const onPress = jest.fn();
    await render(<TextLink label="Sign in" onPress={onPress} />);

    await fireEvent.press(screen.getByRole("link", { name: "Sign in" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
