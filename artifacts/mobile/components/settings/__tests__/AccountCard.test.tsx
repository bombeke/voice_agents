import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccountCard } from "../AccountCard";

const PROPS = {
  name: "Grace Nakato",
  email: "grace@uedcl.example.org",
  role: "Field enumerator",
  offlineSessionDays: 14,
};

describe("AccountCard", () => {
  it("shows who is signed in, how, and for which project", async () => {
    await render(
      <AccountCard
        {...PROPS}
        org="UEDCL"
        method="Casdoor SSO"
        project="Pilot Zone 3"
      />,
    );
    expect(screen.getByText("Grace Nakato")).toBeOnTheScreen();
    expect(screen.getByText("grace@uedcl.example.org")).toBeOnTheScreen();
    expect(screen.getByText("Field enumerator · UEDCL")).toBeOnTheScreen();
    expect(screen.getByText("Casdoor SSO")).toBeOnTheScreen();
    expect(
      screen.getByText("Session renews offline for 14 days"),
    ).toBeOnTheScreen();
  });

  it("switches project only when a picker is wired in", async () => {
    const onSwitchProject = jest.fn();
    const { rerender } = await render(
      <AccountCard {...PROPS} project="Pilot Zone 3" />,
    );
    const button = () =>
      screen.getByRole("button", { name: "Switch project · Pilot Zone 3" });
    expect(button()).toBeDisabled();

    await rerender(
      <AccountCard
        {...PROPS}
        project="Pilot Zone 3"
        onSwitchProject={onSwitchProject}
      />,
    );
    await fireEvent.press(button());
    expect(onSwitchProject).toHaveBeenCalled();
  });

  it("leaves out what it doesn't know", async () => {
    await render(<AccountCard {...PROPS} email={undefined} />);
    expect(screen.getByText("Field enumerator")).toBeOnTheScreen();
    expect(screen.queryByText("Casdoor SSO")).not.toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Choose a project" }),
    ).toBeOnTheScreen();
  });
});
