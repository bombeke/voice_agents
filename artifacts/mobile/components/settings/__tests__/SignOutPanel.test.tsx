import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import { SignOutPanel } from "../SignOutPanel";

type AlertButtons = Parameters<typeof Alert.alert>[2];

beforeEach(() => jest.spyOn(Alert, "alert").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe("SignOutPanel", () => {
  it("warns while records haven't synced", async () => {
    const { rerender } = await render(
      <SignOutPanel pending={3} onSignOut={jest.fn()} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /3 records haven’t synced/,
    );

    await rerender(<SignOutPanel pending={1} onSignOut={jest.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /1 record hasn’t synced/,
    );

    await rerender(<SignOutPanel pending={0} onSignOut={jest.fn()} />);
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });

  it("signs out only after confirming", async () => {
    const onSignOut = jest.fn();
    await render(<SignOutPanel pending={0} onSignOut={onSignOut} />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).not.toHaveBeenCalled();

    const buttons = jest.mocked(Alert.alert).mock.calls[0][2] as AlertButtons;
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
    expect(onSignOut).toHaveBeenCalled();
  });
});
