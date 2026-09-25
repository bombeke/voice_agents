import { hasPerm, isTokenExpired } from "../AuthUtils";

describe("isTokenExpired", () => {
  const NOW = 1_700_000_000;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW * 1000);
  });
  afterEach(() => jest.useRealTimers());

  it("treats a missing expiry as expired", () => {
    expect(isTokenExpired(undefined)).toBe(true);
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired(0)).toBe(true);
  });

  it("is valid well before expiry", () => {
    expect(isTokenExpired(NOW + 3600)).toBe(false);
  });

  it("expires 30 s early (grace window)", () => {
    expect(isTokenExpired(NOW + 31)).toBe(false);
    expect(isTokenExpired(NOW + 30)).toBe(true);
  });

  it("is expired after expiry", () => {
    expect(isTokenExpired(NOW - 1)).toBe(true);
  });
});

describe("hasPerm", () => {
  const claims = { permissions: ["agents:view", "poles:capture"] } as any;

  it("finds a granted permission", () => {
    expect(hasPerm(claims, "agents:view")).toBe(true);
  });

  it("rejects a missing permission", () => {
    expect(hasPerm(claims, "admin:read")).toBe(false);
  });

  it("includes what the roles imply", () => {
    const supervisor = { roles: ["supervisor"], permissions: [] } as any;
    expect(hasPerm(supervisor, "records:review")).toBe(true);
    expect(hasPerm(supervisor, "records:read:own")).toBe(true);
    expect(hasPerm(supervisor, "admin:read")).toBe(false);
  });

  it("is false without claims or a permission list", () => {
    expect(hasPerm(null, "agents:view")).toBe(false);
    expect(hasPerm({} as any, "agents:view")).toBe(false);
  });
});
