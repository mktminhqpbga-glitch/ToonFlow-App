import { describe, expect, test } from "bun:test";
import { verifyMuseNetwork } from "../../../packages/chromeExtension/profileGuard.js";

type ProxyMode = "fixed_servers" | "pac_script" | "direct" | "system" | "auto_detect";
type ProxyValue = { mode: ProxyMode; rules?: object; pacScript?: object };

const direct = { mode: "direct" as const };
const httpsProxy = {
  mode: "fixed_servers" as const,
  rules: { singleProxy: { scheme: "https", host: "test-proxy.example", port: 8443 }, bypassList: [] },
};

// Mock only. No Chrome/profile/proxy is opened or modified and no real fetch is made.
function browserMock(config: ProxyValue, data: { geo1: Record<string, unknown>; geo2: Record<string, unknown> }) {
  const requested: string[] = [];
  const chromeStub = {
    runtime: { lastError: null },
    proxy: { settings: { get: (_options: object, reply: (value: object) => void) => reply({ value: config }) } },
  };
  const fetchStub = async (raw: string | URL, options: RequestInit) => {
    const url = String(raw);
    requested.push(url);
    expect(options.method).toBe("GET");
    expect(options.credentials).toBe("omit");
    expect(options.redirect).toBe("error");
    expect(options.cache).toBe("no-store");
    const dataForUrl = url.includes("ipapi.co") ? data.geo1 : data.geo2;
    const res = new Response(JSON.stringify(dataForUrl), { status: 200, headers: { "Content-Type": "application/json" } });
    Object.defineProperty(res, "url", { value: url });
    return res;
  };
  return { chromeStub, fetchStub, requested };
}
describe("Extension read-only proxy and dual-IP US guard", () => {
  test("rejects direct/system/no proxy without making any external geo request", async () => {
    const previousChrome = (globalThis as any).chrome;
    const previousFetch = globalThis.fetch;
    const data = { geo1: { ip: "8.8.8.8", country_code: "US" }, geo2: { ip: "8.8.8.8", country_code: "US" } };
    try {
      for (const config of [direct, { mode: "system" as const }, { mode: "auto_detect" as const }]) {
        const mock = browserMock(config, data);
        (globalThis as any).chrome = mock.chromeStub;
        globalThis.fetch = mock.fetchStub as typeof fetch;
        const result = await verifyMuseNetwork();
        expect(result.ok).toBe(false);
        expect(mock.requested).toEqual([]);
      }
    } finally { (globalThis as any).chrome = previousChrome; globalThis.fetch = previousFetch; }
  });
  test("accepts only configured proxy with two agreeing public US results", async () => {
    const previousChrome = (globalThis as any).chrome;
    const previousFetch = globalThis.fetch;
    const valid = { ip: "8.8.8.8", country_code: "US" };
    try {
      const mock = browserMock(httpsProxy, { geo1: valid, geo2: { ...valid, success: true } });
      (globalThis as any).chrome = mock.chromeStub; globalThis.fetch = mock.fetchStub as typeof fetch;
      const result = await verifyMuseNetwork();
      expect(result.ok).toBe(true);
      expect(result.countryCode).toBe("US");
      expect(result.proxyMode).toBe("fixed_servers");
      expect(result.ipHint).not.toContain("8.8.8.8");
      expect(mock.requested).toHaveLength(2);
    } finally { (globalThis as any).chrome = previousChrome; globalThis.fetch = previousFetch; }
  });
  test("supports SOCKS5 and HTTP CONNECT proxies while still checking US egress", async () => {
    const previousChrome = (globalThis as any).chrome;
    const previousFetch = globalThis.fetch;
    const valid = { ip: "8.8.8.8", country_code: "US" };
    try {
      for (const scheme of ["socks5", "http"]) {
        const proxy = {
          mode: "fixed_servers" as const,
          rules: { singleProxy: { scheme, host: "proxy.example", port: 1080 }, bypassList: [] },
        };
        const mock = browserMock(proxy, { geo1: valid, geo2: valid });
        (globalThis as any).chrome = mock.chromeStub; globalThis.fetch = mock.fetchStub as typeof fetch;
        expect((await verifyMuseNetwork()).ok).toBe(true);
      }
    } finally { (globalThis as any).chrome = previousChrome; globalThis.fetch = previousFetch; }
  });
  test("blocks non-US and mismatched US IPv4 reports without silently trying again", async () => {
    const previousChrome = (globalThis as any).chrome;
    const previousFetch = globalThis.fetch;
    try {
      for (const samples of [
        { geo1: { ip: "8.8.8.8", country_code: "VN" }, geo2: { ip: "8.8.8.8", country_code: "US" } },
        { geo1: { ip: "8.8.8.8", country_code: "US" }, geo2: { ip: "9.9.9.9", country_code: "US" } },
      ]) {
        const mock = browserMock(httpsProxy, samples);
        (globalThis as any).chrome = mock.chromeStub; globalThis.fetch = mock.fetchStub as typeof fetch;
        const result = await verifyMuseNetwork();
        expect(result.ok).toBe(false);
        expect(mock.requested).toHaveLength(2);
      }
    } finally { (globalThis as any).chrome = previousChrome; globalThis.fetch = previousFetch; }
  });
});
