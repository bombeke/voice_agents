import type { Claims } from "@/types/Auth";
import { jwtDecode } from "jwt-decode";
import { DEV_MOCKS_MARKER, devMocks, FAKE_SSO_CODE } from "..";
import { devMocks as stub } from "../stub";

jest.mock("@/services/Api", () => ({
  axiosClient: require("axios").create({ baseURL: "https://api.test" }),
}));

const { axiosClient } = jest.requireMock("@/services/Api");

beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  devMocks.install();
});

async function post(url: string, data: object) {
  try {
    const res = await axiosClient.post(url, data);
    return { status: res.status as number, data: res.data };
  } catch (err: any) {
    return { status: err.response?.status as number, data: err.response?.data };
  }
}

describe("dev mocks", () => {
  it("is null in the stub that release bundles get", () => {
    expect(stub).toBeNull();
  });

  it("announces itself with the marker the release check looks for", () => {
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(DEV_MOCKS_MARKER),
    );
  });

  it("signs in a listed user by username or email", async () => {
    for (const username of ["admin", "Admin@iip.example.org"]) {
      const res = await post("/auth/login/password", {
        username,
        password: "anything",
      });
      expect(res.status).toBe(200);
      const claims = jwtDecode<Claims>(res.data.access_token);
      expect(claims).toMatchObject({ sub: "admin", roles: ["admin"] });
      expect(res.data.expires_in).toBeGreaterThan(0);
    }
  });

  it("rejects unknown users, empty passwords and the 'wrong' password", async () => {
    for (const body of [
      { username: "nobody", password: "x" },
      { username: "field", password: "" },
      { username: "field", password: "wrong" },
    ]) {
      expect((await post("/auth/login/password", body)).status).toBe(401);
    }
  });

  it("completes the fake SSO round-trip", async () => {
    const result = await devMocks.promptSso({
      state: "s1",
      redirectUri: "mobile://redirect",
    } as never);
    expect(result).toMatchObject({
      type: "success",
      params: { code: FAKE_SSO_CODE, state: "s1" },
    });

    const res = await post("/auth/callback", { code: FAKE_SSO_CODE });
    expect(jwtDecode<Claims>(res.data.access_token).sub).toBe("field");
    expect((await post("/auth/callback", { code: "other" })).status).toBe(400);
  });

  it("refreshes its own tokens only", async () => {
    const signIn = await post("/auth/login/password", {
      username: "supervisor",
      password: "x",
    });
    const refreshed = await post("/auth/refresh", {
      token: signIn.data.access_token,
    });
    expect(jwtDecode<Claims>(refreshed.data.access_token).sub).toBe(
      "supervisor",
    );
    expect((await post("/auth/refresh", { token: "junk" })).status).toBe(401);
  });

  it("refuses to run outside a dev build", () => {
    const g = globalThis as unknown as { __DEV__: boolean };
    g.__DEV__ = false;
    try {
      jest.isolateModules(() => {
        const fresh = require("..");
        expect(() => fresh.devMocks.install()).toThrow(/release build/);
      });
    } finally {
      g.__DEV__ = true;
    }
  });
});
