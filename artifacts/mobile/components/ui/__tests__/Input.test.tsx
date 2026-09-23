import { fireEvent, render, screen } from "@testing-library/react-native";
import { Input } from "../Input";

describe("Input", () => {
  it("shows the placeholder and forwards text changes", async () => {
    const onChangeText = jest.fn();
    await render(
      <Input placeholder="Agent name" onChangeText={onChangeText} />,
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("Agent name"),
      "Pole bot",
    );
    expect(onChangeText).toHaveBeenCalledWith("Pole bot");
  });

  it("displays its value", async () => {
    await render(<Input value="KLA-24A" onChangeText={() => {}} />);
    expect(screen.getByDisplayValue("KLA-24A")).toBeOnTheScreen();
  });
});
