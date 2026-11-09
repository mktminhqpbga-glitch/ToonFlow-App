import { describe, expect, test } from "bun:test";
import { isBridgeDocumentToken, isBridgeResult, providerForUrl } from "./runtime";

const imageHeader = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex").toString("base64");

describe("HD-07 Chrome Companion request and media validation", () => {
  test("only explicitly allowed HTTPS origins can be selected as providers", () => {
    expect(providerForUrl("https://muse.ai/chat")).toBe("muse");
    expect(providerForUrl("https://gemini.google.com/app")).toBe("gemini");
    expect(providerForUrl("https://chatgpt.com/c/123")).toBe("chatgpt");
    expect(providerForUrl("https://muse.ai.evil.example/")).toBeUndefined();
    expect(providerForUrl("http://chatgpt.com/")).toBeUndefined();
    expect(providerForUrl("https://chatgpt.com:444/")).toBeUndefined();
    expect(providerForUrl("https://evil.example/?url=chatgpt.com")).toBeUndefined();
  });
  test("only real document tokens with UUID structure are accepted", () => {
    expect(isBridgeDocumentToken("41a4f04c-9c73-4fb7-a255-c00384c83173")).toBe(true);
    expect(isBridgeDocumentToken("unknown")).toBe(false);
    expect(isBridgeDocumentToken("41a4f04c-9c73-4fb7-a255-c00384c83173;drop")).toBe(false);
  });
  test("wrong output kind, forged MIME and broken video metadata cannot complete tasks", () => {
    const image = { kind: "image", data: imageHeader, mimeType: "image/png", width: 1, height: 1 };
    expect(isBridgeResult(image, "image")).toBe(true);
    expect(isBridgeResult({ ...image, mimeType: "text/html" }, "image")).toBe(false);
    expect(isBridgeResult(image, "video")).toBe(false);
    expect(isBridgeResult({ kind: "video", data: imageHeader, mimeType: "video/mp4", width: 1, height: 1, duration: 0 }, "video")).toBe(false);
    expect(isBridgeResult({ kind: "video", data: imageHeader, mimeType: "video/mp4", width: 1, height: 1, duration: Number.NaN }, "video")).toBe(false);
  });
});
