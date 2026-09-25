import { render, screen } from "@testing-library/react-native";
import { InfoNote } from "../InfoNote";

describe("InfoNote", () => {
  it("renders its message", async () => {
    await render(<InfoNote>We’ll email a verification link.</InfoNote>);
    expect(
      screen.getByText("We’ll email a verification link."),
    ).toBeOnTheScreen();
  });

  it("announces a warning", async () => {
    await render(<InfoNote tone="warning">3 records haven’t synced.</InfoNote>);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "3 records haven’t synced.",
    );
  });

  it("leads with a bold title", async () => {
    await render(
      <InfoNote tone="success" title="Each asset has its own coordinates.">
        Nothing was uploaded.
      </InfoNote>,
    );
    expect(
      screen.getByText(
        "Each asset has its own coordinates. Nothing was uploaded.",
      ),
    ).toBeOnTheScreen();
  });
});
