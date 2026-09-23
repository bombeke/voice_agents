import { render, screen } from "@testing-library/react-native";
import { InfoNote } from "../InfoNote";

describe("InfoNote", () => {
  it("renders its message", async () => {
    await render(<InfoNote>We’ll email a verification link.</InfoNote>);
    expect(
      screen.getByText("We’ll email a verification link."),
    ).toBeOnTheScreen();
  });
});
