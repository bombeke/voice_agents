import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import { SignInView } from "../SignInView";

const mockSso = {
  start: jest.fn(),
  busy: false,
  error: null as string | null,
  clearError: jest.fn(),
};
const mockPassword = {
  submit: jest.fn(),
  busy: false,
  error: null as string | null,
  reset: jest.fn(),
};

jest.mock("@/hooks/useSsoSignIn", () => ({ useSsoSignIn: () => mockSso }));
jest.mock("@/hooks/usePasswordSignIn", () => ({
  usePasswordSignIn: () => mockPassword,
}));
jest.mock("@/constants/Config", () => ({
  API_URL: "https://iip.example.org",
}));
jest.mock("@react-native-community/netinfo", () =>
  require("@react-native-community/netinfo/jest/netinfo-mock.js"),
);

beforeEach(() => {
  jest.clearAllMocks();
  mockSso.error = null;
  mockPassword.error = null;
});

async function fillCredentials() {
  await fireEvent.changeText(
    screen.getByLabelText("Username or email"),
    "field@iip.example.org",
  );
  await fireEvent.changeText(screen.getByLabelText("Password"), "fieldwork");
}

describe("SignInView", () => {
  it("renders the sign-in options from the design", async () => {
    await render(<SignInView />);

    expect(screen.getByRole("header")).toHaveTextContent(
      /Intelligent\s+Infrastructure\s+Platform/,
    );
    expect(
      screen.getByRole("button", { name: "Continue with SSO" }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: /Continue with Google/ }),
    ).toBeOnTheScreen();
    expect(screen.getByText("or with username")).toBeOnTheScreen();
    expect(
      screen.getByRole("checkbox", {
        name: "Keep me signed in on this device",
      }),
    ).toBeChecked();
    expect(screen.getByText("iip.example.org")).toBeOnTheScreen();
  });

  it("enables Sign in once both fields are filled", async () => {
    await render(<SignInView />);
    const signIn = screen.getByRole("button", { name: "Sign in" });
    expect(signIn).toBeDisabled();

    await fillCredentials();
    expect(signIn).toBeEnabled();
  });

  it("submits the credentials with the keep-signed-in choice", async () => {
    await render(<SignInView />);
    await fillCredentials();
    await fireEvent.press(screen.getByRole("checkbox"));
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));

    expect(mockPassword.submit).toHaveBeenCalledWith({
      identifier: "field@iip.example.org",
      password: "fieldwork",
      persist: false,
    });
  });

  it("starts SSO and clears any password error", async () => {
    await render(<SignInView />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Continue with SSO" }),
    );

    expect(mockPassword.reset).toHaveBeenCalled();
    expect(mockSso.start).toHaveBeenCalledWith(true);
  });

  it("shows sign-in errors as an alert", async () => {
    mockPassword.error = "invalid_credentials";
    await render(<SignInView />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That username or password is incorrect.",
    );
  });

  it("marks the options that are not built yet as coming soon", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<SignInView />);

    await fireEvent.press(
      screen.getByRole("button", { name: /Continue with Google/ }),
    );
    for (const name of [
      "Forgot password?",
      "Create an account",
      "Change server",
    ]) {
      await fireEvent.press(screen.getByRole("link", { name }));
    }

    expect(alert).toHaveBeenCalledTimes(4);
    expect(alert).toHaveBeenCalledWith(
      "Coming soon",
      "This option isn't available yet.",
    );
  });
});
