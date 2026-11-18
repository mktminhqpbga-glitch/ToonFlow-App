import { afterEach, describe, expect, test } from "bun:test";
import { bridgeApiKey, bridgeConnection, probeBridge, selectedBridgeSource, verifyCustomBridgeKey } from "../src/utils/aiBridge/connection";

const sourceBefore = process.env.MACFLOW_AI_BRIDGE_SOURCE;
const keyBefore = process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY;
const fetchBefore = globalThis.fetch;
const secret = "local-test-key-not-a-real-credential-000000";
afterEach(() => {
  if (sourceBefore === undefined) delete process.env.MACFLOW_AI_BRIDGE_SOURCE;
  else process.env.MACFLOW_AI_BRIDGE_SOURCE = sourceBefore;
  if (keyBefore === undefined) delete process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY;
  else process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY = keyBefore;
  globalThis.fetch = fetchBefore;
});

describe("MacFlow explicit AI-Bridge source selection", () => {
  test("custom uses API without accessing service-owned files; Original stays independent", () => {
    const custom = bridgeConnection("custom"), original = bridgeConnection("original");
    expect(custom.origin).toBe("http://127.0.0.1:4319");
    expect(original.origin).toBe("http://127.0.0.1:4320");
    expect(custom.apiKeyFile).toBeUndefined();
    expect(original.apiKeyFile).toEndWith("AI-Bridge-Original-Data/api-key");
    expect(Object.hasOwn(custom, "extensionTokenFile")).toBe(false);
    expect(Object.hasOwn(original, "extensionTokenFile")).toBe(false);
  });
  test("default stays on existing original without auto switching", () => {
    delete process.env.MACFLOW_AI_BRIDGE_SOURCE;
    expect(selectedBridgeSource()).toBe("original");
  });
  test("only explicit source names are valid", () => {
    process.env.MACFLOW_AI_BRIDGE_SOURCE = "custom";
    expect(selectedBridgeSource()).toBe("custom");
    process.env.MACFLOW_AI_BRIDGE_SOURCE = "auto";
    expect(selectedBridgeSource).toThrow(/original hoặc custom/);
  });
  test("read-only candidate probe checks 4319 key and tab without chat submission", async () => {
    process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY = secret;
    // A key previously saved by MacFlow takes precedence over the env fallback.
    // Use that effective key without modifying the real 0600 configuration.
    const effectiveKey = bridgeApiKey("custom");
    const requests: string[] = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const address = new URL(url);
      requests.push(address.pathname);
      if (address.pathname === "/health") return Response.json({ ok: true });
      expect((init?.headers as Record<string, string>)?.Authorization).toBe(`Bearer ${effectiveKey}`);
      return Response.json({ connected_extensions: 1, tabs: [{ ready: true, busy: false }] });
    }) as typeof fetch;
    const found = await probeBridge("custom");
    expect(found.canSelect).toBe(true);
    expect(found.origin).toBe("http://127.0.0.1:4319");
    expect(requests).toEqual(["/health", "/api/bridge/status"]);
    expect(JSON.stringify(found)).not.toContain(effectiveKey);
  });
  test("wrong API key or no connected extension never marks 4319 ready", async () => {
    process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY = secret;
    globalThis.fetch = (async (url: string) => new URL(url).pathname === "/health"
      ? Response.json({ ok: true }) : Response.json({ error: "Invalid" }, { status: 401 })) as typeof fetch;
    const found = await probeBridge("custom");
    expect(found.healthOk).toBe(true);
    expect(found.authorized).toBe(false);
    expect(found.canSelect).toBe(false);
  });

  test("single-key verification enables media only for a pinned-capable HTTPS tab and 0.6.x extension", async () => {
    const paths: string[] = [];
    globalThis.fetch = (async (input: string) => {
      const path = new URL(input).pathname;
      paths.push(path);
      if (path === "/health") return Response.json({ ok: true });
      if (path === "/v1/models") return Response.json({ data: [{ id: "bridge-chatgpt" }] });
      return Response.json({ connected_extensions: 1, extension_versions: ["0.6.0"], tabs: [{
        profileInstanceId: "11111111-1111-4111-8111-111111111111", tabId: 42,
        documentToken: "22222222-2222-4222-8222-222222222222",
        provider: "chatgpt", url: "https://chatgpt.com/", ready: true, busy: false, outputKinds: ["image"],
      }] });
    }) as typeof fetch;
    const result = await verifyCustomBridgeKey(secret);
    expect(result.apiOk).toBe(true);
    expect(result.mediaReady).toBe(true);
    expect(paths).toEqual(["/health", "/v1/models", "/api/bridge/status"]);
    expect(paths).not.toContain("/v1/chat/completions");
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  test("a discovered tab with no verified identity or mismatched extension count does not activate media", async () => {
    let connected = 1;
    globalThis.fetch = (async (input: string) => {
      const path = new URL(input).pathname;
      if (path === "/health") return Response.json({ ok: true });
      if (path === "/v1/models") return Response.json({ data: [{ id: "bridge-chatgpt" }] });
      return Response.json({ connected_extensions: connected, extension_versions: ["0.6.0"], tabs: [{
        provider: "chatgpt", url: "https://chatgpt.com/", ready: true, busy: false, outputKinds: ["image"],
      }] });
    }) as typeof fetch;
    const missingTarget = await verifyCustomBridgeKey(secret);
    expect(missingTarget.apiOk).toBe(true);
    expect(missingTarget.mediaReady).toBe(false);
    connected = 2;
    const missingExtension = await verifyCustomBridgeKey(secret);
    expect(missingExtension.mediaReady).toBe(false);
  });
});
