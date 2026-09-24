import {
  displayName,
  formatAppVersion,
  formatBytes,
  formatLastSynced,
  hostOf,
  roleLabel,
  storageBreakdown,
} from "../settings";

const NOW = new Date(2026, 8, 24, 14, 30);

describe("formatBytes", () => {
  it("uses MB below a gigabyte and GB with one decimal above", () => {
    expect(formatBytes(0)).toBe("0 MB");
    expect(formatBytes(18_000_000)).toBe("18 MB");
    expect(formatBytes(312_400_000)).toBe("312 MB");
    expect(formatBytes(1_400_000_000)).toBe("1.4 GB");
  });
});

describe("storageBreakdown", () => {
  it("totals every kind and gives each bar segment its share", () => {
    const { totalBytes, segments } = storageBreakdown({
      photosBytes: 500,
      syncedPhotosBytes: 100,
      mapBytes: 250,
      modelBytes: 50,
      otherBytes: 200,
    });
    expect(totalBytes).toBe(1000);
    expect(segments).toEqual([
      { kind: "photos", bytes: 500, share: 0.5 },
      { kind: "map", bytes: 250, share: 0.25 },
      { kind: "model", bytes: 50, share: 0.05 },
    ]);
  });

  it("has empty segments on an empty device", () => {
    const { totalBytes, segments } = storageBreakdown({
      photosBytes: 0,
      syncedPhotosBytes: 0,
      mapBytes: 0,
      modelBytes: 0,
      otherBytes: 0,
    });
    expect(totalBytes).toBe(0);
    expect(segments.every((s) => s.share === 0)).toBe(true);
  });
});

describe("formatLastSynced", () => {
  it("says today or yesterday with the time", () => {
    expect(
      formatLastSynced(new Date(2026, 8, 24, 9, 2).toISOString(), NOW),
    ).toBe("Today 09:02");
    expect(
      formatLastSynced(new Date(2026, 8, 23, 17, 40).toISOString(), NOW),
    ).toBe("Yesterday 17:40");
  });

  it("gives the date for older syncs", () => {
    expect(
      formatLastSynced(new Date(2026, 7, 12, 8, 0).toISOString(), NOW),
    ).toBe("12 Aug 2026");
  });

  it("says never without a valid time", () => {
    expect(formatLastSynced(undefined, NOW)).toBe("Never");
    expect(formatLastSynced("not a date", NOW)).toBe("Never");
  });
});

describe("displayName", () => {
  it("prefers the full name, then the username, then the subject", () => {
    expect(displayName({ sub: "u1", exp: 0, name: "Grace Nakato" })).toBe(
      "Grace Nakato",
    );
    expect(
      displayName({ sub: "u1", exp: 0, preferred_username: "grace" }),
    ).toBe("grace");
    expect(displayName({ sub: "u1", exp: 0 })).toBe("u1");
    expect(displayName(null)).toBe("Signed-in user");
  });
});

describe("roleLabel", () => {
  it("shows the highest role held", () => {
    const claims = (roles?: string[]) => ({ sub: "u", exp: 0, roles });
    expect(roleLabel(claims(["enumerator", "admin"]))).toBe("Administrator");
    expect(roleLabel(claims(["supervisor"]))).toBe("Supervisor");
    expect(roleLabel(claims(["enumerator"]))).toBe("Field enumerator");
    expect(roleLabel(claims())).toBe("Field enumerator");
  });
});

describe("hostOf", () => {
  it("keeps only the host of a URL", () => {
    expect(hostOf("https://iip.example.org/api/v1")).toBe("iip.example.org");
    expect(hostOf("http://10.0.2.2:8000")).toBe("10.0.2.2");
    expect(hostOf("iip.example.org")).toBe("iip.example.org");
  });
});

describe("formatAppVersion", () => {
  it("adds the build number when known", () => {
    expect(formatAppVersion("1.0.0", "100")).toBe("1.0.0 (100)");
    expect(formatAppVersion("1.0.0", null)).toBe("1.0.0");
    expect(formatAppVersion(null, null)).toBe("0.0.0");
  });
});
