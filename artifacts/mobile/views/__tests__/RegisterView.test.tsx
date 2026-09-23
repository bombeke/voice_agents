import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import { RegisterView } from "../RegisterView";

const mockRegister = {
  submit: jest.fn(),
  busy: false,
  done: false,
  error: null as string | null,
  reset: jest.fn(),
};
const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock("@/hooks/useRegister", () => ({ useRegister: () => mockRegister }));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

const TERMS = /^I agree to the terms of use and privacy policy/;

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockRegister, { busy: false, done: false, error: null });
  mockRouter.canGoBack.mockReturnValue(true);
});

async function type(label: string, value: string) {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}

async function fillValidForm() {
  await type("Full name", "  Grace Nakato ");
  await type("Work email", "Grace@UEDCL.example.org");
  await type("Phone number", "+256 700 123 456");
  await type("Password", "fieldwork2026");
  await type("Confirm password", "fieldwork2026");
  await fireEvent.press(screen.getByRole("checkbox", { name: TERMS }));
}

const pressCreate = () =>
  fireEvent.press(screen.getByRole("button", { name: "Create account" }));

describe("RegisterView", () => {
  it("renders the form from the design", async () => {
    await render(<RegisterView />);

    expect(screen.getByRole("header")).toHaveTextContent("Create an account");
    for (const label of [
      "Full name",
      "Work email",
      "Phone number",
      "Password",
      "Confirm password",
    ]) {
      expect(screen.getByLabelText(label)).toBeOnTheScreen();
    }
    expect(screen.getByText("Phone number (optional)")).toBeOnTheScreen();
    expect(screen.getByRole("checkbox", { name: TERMS })).not.toBeChecked();
    expect(
      screen.getByText(/We’ll email a verification link/),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("At least 10 characters with a number"),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });

  it("shows field errors instead of submitting an empty form", async () => {
    await render(<RegisterView />);
    await pressCreate();

    expect(mockRegister.submit).not.toHaveBeenCalled();
    for (const message of [
      "Enter your full name.",
      "Enter your work email.",
      "Choose a password.",
      "Accept the terms of use and privacy policy to continue.",
    ]) {
      expect(screen.getByText(message)).toBeOnTheScreen();
    }
  });

  it("clears a field's error once it is fixed", async () => {
    await render(<RegisterView />);
    await pressCreate();
    await type("Full name", "Grace Nakato");

    expect(screen.queryByText("Enter your full name.")).not.toBeOnTheScreen();
  });

  it("requires the terms to be accepted", async () => {
    await render(<RegisterView />);
    await fillValidForm();
    await fireEvent.press(screen.getByRole("checkbox", { name: TERMS }));
    await pressCreate();

    expect(mockRegister.submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Accept the terms of use and privacy policy to continue.",
    );
  });

  it("flags mismatched passwords", async () => {
    await render(<RegisterView />);
    await fillValidForm();
    await type("Confirm password", "fieldwork2025");
    await pressCreate();

    expect(mockRegister.submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The passwords don’t match.",
    );
  });

  it("rates the password as it is typed", async () => {
    await render(<RegisterView />);
    await type("Password", "fieldwork2026");

    expect(
      screen.getByText("Strong · at least 10 characters with a number"),
    ).toBeOnTheScreen();
  });

  it("submits the normalised registration", async () => {
    await render(<RegisterView />);
    await fillValidForm();
    await pressCreate();

    expect(mockRegister.submit).toHaveBeenCalledWith({
      name: "Grace Nakato",
      email: "grace@uedcl.example.org",
      phone: "+256700123456",
      password: "fieldwork2026",
    });
  });

  it.each([
    [
      "email_taken",
      "An account with this email already exists. Sign in instead.",
    ],
    ["offline", /needs a connection/],
  ])("shows the %p error", async (code, message) => {
    mockRegister.error = code;
    await render(<RegisterView />);

    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("clears a submit error when the form is edited", async () => {
    mockRegister.error = "server_unreachable";
    await render(<RegisterView />);
    await type("Full name", "G");

    expect(mockRegister.reset).toHaveBeenCalled();
  });

  it("opens the terms and privacy links", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<RegisterView />);

    await fireEvent.press(screen.getByRole("link", { name: "terms of use" }));
    await fireEvent.press(screen.getByRole("link", { name: "privacy policy" }));

    expect(alert).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("checkbox", { name: TERMS })).not.toBeChecked();
  });

  it("goes back to sign in from the header and the footer link", async () => {
    await render(<RegisterView />);

    await fireEvent.press(
      screen.getByRole("button", { name: "Back to sign in" }),
    );
    await fireEvent.press(screen.getByRole("link", { name: "Sign in" }));
    expect(mockRouter.back).toHaveBeenCalledTimes(2);
  });

  it("replaces the route with sign in when there is no history", async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    await render(<RegisterView />);
    await fireEvent.press(screen.getByRole("link", { name: "Sign in" }));

    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/(auth)/login",
    });
  });

  it("confirms the sign-up and leads back to sign in", async () => {
    await render(<RegisterView />);
    await fillValidForm();
    mockRegister.done = true;
    await screen.rerender(<RegisterView />);

    expect(screen.getByRole("header")).toHaveTextContent("Check your email");
    expect(screen.getByText(/grace@uedcl\.example\.org/)).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole("button", { name: "Back to sign in" }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
