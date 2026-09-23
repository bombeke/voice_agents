import { render, screen } from "@testing-library/react-native";
import { Text, TextInput } from "react-native";
import { FormField } from "../FormField";

describe("FormField", () => {
  it("labels its input and marks optional fields", async () => {
    await render(
      <FormField label="Phone number" optional>
        <TextInput accessibilityLabel="Phone number" />
      </FormField>,
    );
    expect(screen.getByLabelText("Phone number")).toBeOnTheScreen();
    expect(screen.getByText("Phone number (optional)")).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });

  it("announces its error and renders the footer", async () => {
    await render(
      <FormField
        label="Full name"
        error="Enter your full name."
        footer={<Text>Hint</Text>}
      >
        <TextInput accessibilityLabel="Full name" />
      </FormField>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter your full name.",
    );
    expect(screen.getByText("Hint")).toBeOnTheScreen();
  });
});
