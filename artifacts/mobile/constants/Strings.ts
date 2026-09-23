/**
 * User-facing copy. Keep labels here (not inline) so they can move to an i18n
 * catalogue without touching components.
 */
export const strings = {
  auth: {
    title: "Intelligent\nInfrastructure\nPlatform",
    subtitle: "Map, inspect and report public infrastructure from the field.",
    logoLabel: "Intelligent Infrastructure Platform logo",
    continueWithSso: "Continue with SSO",
    continueWithGoogle: "Continue with Google",
    orWithUsername: "or with username",
    usernameLabel: "Username or email",
    usernamePlaceholder: "name@organisation.org",
    passwordLabel: "Password",
    forgotPassword: "Forgot password?",
    showPassword: "Show password",
    hidePassword: "Hide password",
    keepSignedIn: "Keep me signed in on this device",
    signIn: "Sign in",
    newToPlatform: "New to the platform?",
    createAccount: "Create an account",
    changeServer: "Change server",
    serverOnline: "Server reachable",
    serverOffline: "No connection",
    comingSoonTitle: "Coming soon",
    comingSoonMessage: "This option isn't available yet.",
    errors: {
      invalidCredentials: "That username or password is incorrect.",
      ssoOffline: "SSO needs a connection. Sign in with your username instead.",
      ssoFailed: "SSO sign-in didn't complete. Please try again.",
      serverUnreachable: "Could not reach the server. Please try again.",
    },
  },
} as const;
