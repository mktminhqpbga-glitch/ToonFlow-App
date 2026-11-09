import { describe, expect, test } from "bun:test";
import { authorizeBridgeRequest } from "./access";

const good = {
  desktopAllowed: false, localWebAllowed: true, loopback: true,
  method: "POST", desktopHeader: "1", localClientHeader: "1",
  origin: "http://127.0.0.1:5020", referer: "http://127.0.0.1:5020/workspace",
  expectedOrigin: "http://127.0.0.1:5020",
};

describe("HD-07 live Bridge route access policy", () => {
  test("only local same-origin, opted-in requests pass", () => {
    expect(authorizeBridgeRequest(good)).toBe(true);
    expect(authorizeBridgeRequest({ ...good, desktopAllowed: false, localWebAllowed: false })).toBe(false);
    expect(authorizeBridgeRequest({ ...good, loopback: false })).toBe(false);
  });
  test("cannot spoof browser Origin, Referer or local Vite proxy", () => {
    expect(authorizeBridgeRequest({ ...good, origin: "https://untrusted.example" })).toBe(false);
    expect(authorizeBridgeRequest({ ...good, referer: "http://127.0.0.1:5020.evil.example/" })).toBe(false);
    expect(authorizeBridgeRequest({ ...good, localClientHeader: "0" })).toBe(false);
    expect(authorizeBridgeRequest({ ...good, origin: undefined, referer: undefined })).toBe(false);
  });
  test("writes require explicit authorized desktop/client intent header", () => {
    expect(authorizeBridgeRequest({ ...good, desktopHeader: undefined })).toBe(false);
    expect(authorizeBridgeRequest({ ...good, desktopHeader: "0" })).toBe(false);
    expect(authorizeBridgeRequest({ ...good, method: "GET", desktopHeader: undefined })).toBe(true);
  });
});
