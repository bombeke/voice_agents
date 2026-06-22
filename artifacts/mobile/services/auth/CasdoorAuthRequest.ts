import {
    AuthRequest,
    AuthRequestPromptOptions,
    AuthSessionRedirectUriOptions,
    AuthSessionResult,
    DiscoveryDocument,
    makeRedirectUri,
    ProviderAuthRequestConfig,
    useAuthRequestResult,
    useLoadedAuthRequest
} from "expo-auth-session";
import { useMemo } from "react";

export type CasdoorAuthRequestConfig =
  ProviderAuthRequestConfig
& {
  /**
   * IMPORTANT:
   * If provided, this value overrides the locally generated state.
   * Use this to inject FastAPI-generated Casdoor state.
   */
  state?: string;
};

export type CasdoorDiscovery = DiscoveryDocument & {
  authorizationEndpoint: string;
  tokenEndpoint?: string;
  userInfoEndpoint?: string;
};

export function getCasdoorDiscovery(
  casdoorEndpoint: string,
  organizationName: string
): CasdoorDiscovery {
  return {
    authorizationEndpoint: `${casdoorEndpoint}/login/oauth/authorize`,
    tokenEndpoint: `${casdoorEndpoint}/api/login/oauth/access_token`,
    userInfoEndpoint: `${casdoorEndpoint}/api/get-account`,
  };
}


export class CasdoorAuthRequest extends AuthRequest {
  constructor(config: CasdoorAuthRequestConfig) {
    super({
      ...config,
      state: config.state,
    });
  }
}


export function useCasdoorAuthRequest(
  config: Partial<CasdoorAuthRequestConfig> = {},
  discovery: CasdoorDiscovery,
  redirectUriOptions: Partial<AuthSessionRedirectUriOptions> = {}
): [
  CasdoorAuthRequest | null,
  AuthSessionResult | null,
  (options?: AuthRequestPromptOptions) => Promise<AuthSessionResult>,
] {
  const redirectUri = useMemo(() => {
    return config.redirectUri ??
      makeRedirectUri({ ...redirectUriOptions });
  }, [config.redirectUri, redirectUriOptions]);

  const extraParams = useMemo(() => {
    const output = { ...(config.extraParams ?? {}) };
    if (config.language) {
      output.locale = config.language;
    }
    return output;
  }, [config.extraParams, config.language]);

  const request = useLoadedAuthRequest(
    {
      clientId: config.clientId!,
      redirectUri,
      scopes: config.scopes ?? ["openid", "profile", "email"],
      responseType: "code",
      usePKCE: true,
      state: config.state,

      extraParams,
    },
    discovery,
    CasdoorAuthRequest
  );

  const [result, promptAsync] =
    useAuthRequestResult(request, discovery);

  return [request, result, promptAsync];
}
