import { describe, expect, test } from "bun:test";
import { isVerifiedUsProxy, type MuseEgressProof } from "../src/utils/aiChrome/museNetworkPolicy";
import { selectMuseProfile, verifyMuseNetwork, museProfileStatus } from "../src/utils/aiChrome";

describe("Muse2API Chrome Profile 22: proxy/IP US fail closed", () => {
  const now = 1_800_000_000_000;
  const good: MuseEgressProof = { ok: true, countryCode: "US", proxyMode: "fixed_servers", checkedAt: now - 1000 };
  test("accepts recent confirmed US egress over a configured Chrome proxy", () => {
    expect(isVerifiedUsProxy(good, now)).toBe(true);
    expect(isVerifiedUsProxy({ ...good, proxyMode: "pac_script" }, now)).toBe(true);
  });
  test("blocks missing proxy even when a direct US network happens to be located in the US", () => {
    for (const mode of ["direct", "system", "auto_detect", "unknown"] as const)
      expect(isVerifiedUsProxy({ ...good, proxyMode: mode }, now)).toBe(false);
  });
  test("blocks non-US, unknown, malformed and unsuccessful IP verification", () => {
    expect(isVerifiedUsProxy(undefined, now)).toBe(false);
    expect(isVerifiedUsProxy({ ...good, countryCode: "VN" }, now)).toBe(false);
    expect(isVerifiedUsProxy({ ...good, countryCode: "CA" }, now)).toBe(false);
    expect(isVerifiedUsProxy({ ...good, countryCode: undefined }, now)).toBe(false);
    expect(isVerifiedUsProxy({ ...good, ok: false }, now)).toBe(false);
  });
  test("blocks expired, future and nonnumeric proofs before AI Send", () => {
    expect(isVerifiedUsProxy({ ...good, checkedAt: now - 21_000 }, now)).toBe(false);
    expect(isVerifiedUsProxy({ ...good, checkedAt: now + 5_001 }, now)).toBe(false);
    expect(isVerifiedUsProxy({ ...good, checkedAt: NaN }, now)).toBe(false);
    expect(isVerifiedUsProxy({ ...good, checkedAt: -1 }, now)).toBe(false);
  });
  test("refuses to select a fake/uncorroborated profile or verify without a paired extension", async () => {
    expect(museProfileStatus().verified).toBe(false);
    await expect(verifyMuseNetwork()).rejects.toThrow(/Chưa chọn và xác nhận/);
    await expect(selectMuseProfile({ profileDirectory: "Profile 21", confirmedExtensionInProfile: true }))
      .rejects.toThrow(/Profile 22/);
    await expect(selectMuseProfile({ profileDirectory: "Profile 22", confirmedExtensionInProfile: false }))
      .rejects.toThrow(/Profile 22/);
    await expect(selectMuseProfile({ profileDirectory: "Profile 22", confirmedExtensionInProfile: true }))
      .rejects.toThrow(/Cần ghép và kết nối extension/);
  });
});
