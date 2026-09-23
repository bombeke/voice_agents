import { API_URL, AUTH_REDIRECT_SCHEME } from "@/constants/Config";
import { devMocks } from "@/mocks";
import { useAuth } from "@/providers/AuthProvider";
import {
  AuthError,
  authErrorCode,
  type AuthErrorCode,
  exchangeSsoCode,
  validateCasdoorAuthResponse,
} from "@/services/auth/AuthService";
import NetInfo from "@react-native-community/netinfo";
import {
  makeRedirectUri,
  ResponseType,
  useAuthRequest,
} from "expo-auth-session";
import {
  coolDownAsync,
  maybeCompleteAuthSession,
  warmUpAsync,
} from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

maybeCompleteAuthSession();

/**
 * "Continue with SSO": Casdoor via the backend (`/auth/login` → `/auth/callback`)
 * with PKCE. In API-mocking dev builds the browser step is faked, and the rest
 * runs against the fake server.
 */
export function useSsoSignIn() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorCode | null>(null);

  const redirectUri = useMemo(
    () => makeRedirectUri({ scheme: AUTH_REDIRECT_SCHEME }),
    [],
  );
  const [request, , promptAsync] = useAuthRequest(
    {
      clientId: "dummy",
      redirectUri,
      responseType: ResponseType.Code,
      usePKCE: true,
    },
    { authorizationEndpoint: `${API_URL}/auth/login` },
  );

  useEffect(() => {
    if (devMocks || Platform.OS === "web") return;
    warmUpAsync();
    return () => {
      coolDownAsync();
    };
  }, []);

  const start = useCallback(
    async (persist: boolean) => {
      setError(null);
      setBusy(true);
      try {
        const net = await NetInfo.fetch();
        if (!net.isConnected) throw new AuthError("offline");
        if (!request) throw new AuthError("sso_failed");

        const result = devMocks
          ? await devMocks.promptSso(request)
          : await promptAsync();
        if (result.type === "cancel" || result.type === "dismiss") return;
        validateCasdoorAuthResponse(result, request.state);

        const session = await exchangeSsoCode({
          code: result.params.code,
          state: result.params.state,
          codeVerifier: request.codeVerifier,
          redirectUri,
          persist,
        });
        await signIn(session);
      } catch (err) {
        setError(authErrorCode(err, "sso_failed"));
      } finally {
        setBusy(false);
      }
    },
    [request, promptAsync, redirectUri, signIn],
  );

  const clearError = useCallback(() => setError(null), []);

  return { start, busy, error, clearError };
}
