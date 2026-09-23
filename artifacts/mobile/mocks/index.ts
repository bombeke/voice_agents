import { axiosClient } from "@/services/Api";
import type { Claims } from "@/types/Auth";
import MockAdapter from "axios-mock-adapter";
import type { AuthSessionResult } from "expo-auth-session";
import { jwtDecode } from "jwt-decode";
import {
  FAKE_SSO_USER,
  FAKE_USERS,
  type FakeUser,
  REJECTED_PASSWORD,
} from "./fixtures";
import { FAKE_TOKEN_TTL, fakeClaims, fakeToken } from "./token";
import type { DevMocks } from "./types";

/**
 * Dev-only fake backend for the auth endpoints. The app's real sign-in code
 * runs unchanged; only the server answering it is fake. Metro swaps this module
 * for mocks/stub.ts unless EXPO_PUBLIC_API_MOCKING=enabled.
 *
 * `scripts/check-release-bundle.sh` fails the build if this marker is bundled.
 */
export const DEV_MOCKS_MARKER = "__IIP_DEV_MOCKS__";
export const FAKE_SSO_CODE = "dev-sso-code";

function tokenResponse(user: FakeUser) {
  const claims = fakeClaims(user);
  return { access_token: fakeToken(claims), expires_in: FAKE_TOKEN_TTL };
}

function findUser(identifier: unknown): FakeUser | undefined {
  const id = String(identifier ?? "")
    .trim()
    .toLowerCase();
  return FAKE_USERS.find((u) => u.username === id || u.email === id);
}

function body(data: unknown): Record<string, unknown> {
  return typeof data === "string" ? JSON.parse(data) : ((data ?? {}) as never);
}

let adapter: MockAdapter | null = null;

export const devMocks: DevMocks = {
  install() {
    if (!__DEV__) {
      throw new Error("Dev mocks must never run in a release build.");
    }
    if (adapter) return;
    console.warn(`${DEV_MOCKS_MARKER} Fake API enabled for auth endpoints.`);

    adapter = new MockAdapter(axiosClient, {
      delayResponse: 400,
      onNoMatch: "passthrough",
    });

    adapter.onPost("/auth/login/password").reply((config) => {
      const { username, password } = body(config.data);
      const user = findUser(username);
      if (!user || !password || password === REJECTED_PASSWORD) {
        return [401, { detail: "Invalid username or password" }];
      }
      return [200, tokenResponse(user)];
    });

    adapter
      .onPost("/auth/callback")
      .reply((config) =>
        body(config.data).code === FAKE_SSO_CODE
          ? [200, tokenResponse(FAKE_SSO_USER)]
          : [400, { detail: "Invalid authorization code" }],
      );

    adapter.onPost("/auth/refresh").reply((config) => {
      try {
        const { sub } = jwtDecode<Claims>(String(body(config.data).token));
        const user = findUser(sub);
        if (user) return [200, tokenResponse(user)];
      } catch {
        // Fall through: not one of our tokens.
      }
      return [401, { detail: "Invalid token" }];
    });
  },

  async promptSso(request): Promise<AuthSessionResult> {
    const params = { code: FAKE_SSO_CODE, state: request.state };
    return {
      type: "success",
      errorCode: null,
      params,
      authentication: null,
      url: `${request.redirectUri}?code=${FAKE_SSO_CODE}&state=${encodeURIComponent(params.state ?? "")}`,
    };
  },
};
