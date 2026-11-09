import { describe, expect, test } from "bun:test";
import { verifyChromeMediaSignature } from "./mediaSignature";

const bytes = (hex: string) => Buffer.from(hex.replaceAll(" ", ""), "hex");
const png = bytes("89504e470d0a1a0a0000000d4948445200000001");
const mp4 = bytes("000000186674797069736f6d0000020069736f6d6d703431");

describe("HD-07 real media binary signatures (not provider E2E)", () => {
  test("accepts correct PNG and MP4 container headers", () => {
    expect(() => verifyChromeMediaSignature(png, "image/png")).not.toThrow();
    expect(() => verifyChromeMediaSignature(mp4, "video/mp4")).not.toThrow();
  });
  test("rejects thumbnail or arbitrary HTML falsely declared as MP4", () => {
    expect(() => verifyChromeMediaSignature(png, "video/mp4")).toThrow();
    expect(() => verifyChromeMediaSignature(Buffer.from("<html>not a movie; this is a web page</html>"), "video/mp4")).toThrow();
    expect(() => verifyChromeMediaSignature(mp4, "image/png")).toThrow();
  });
  test("rejects incorrectly labeled QuickTime and tiny bogus buffers", () => {
    expect(() => verifyChromeMediaSignature(mp4, "video/quicktime")).toThrow();
    expect(() => verifyChromeMediaSignature(Buffer.from("fake"), "image/png")).toThrow();
  });
});
