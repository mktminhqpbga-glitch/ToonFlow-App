import { afterEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { bridgeConnection, normalizeBridgeBaseUrl } from "../src/utils/aiBridge/connection";
import { fetchAiBrModels, getAiBrTextProvider, verifyAiBrTextTarget } from "../src/utils/aiBridge/models";
import { getConfiguredModel, listAiModels } from "../src/utils/ai";

const beforeFetch = globalThis.fetch;
const beforeKey = process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY;
process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY = "fixture-ai-br-credentials-not-real-123456789";
afterEach(() => { globalThis.fetch = beforeFetch;
  if (beforeKey === undefined) delete process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY;
  else process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY = beforeKey;
});

describe("Built-in AI-Br OpenAI provider (no external requests)", () => {
  test("validates Cloud HTTPS and permits only loopback HTTP", () => {
    expect(normalizeBridgeBaseUrl("https://bridge.example.com/v1")).toBe("https://bridge.example.com");
    expect(normalizeBridgeBaseUrl("http://127.0.0.1:4319/v1")).toBe("http://127.0.0.1:4319");
    expect(() => normalizeBridgeBaseUrl("http://bridge.example.com/v1")).toThrow();
    expect(() => normalizeBridgeBaseUrl("https://name:password@bridge.example.com/v1")).toThrow();
    expect(() => normalizeBridgeBaseUrl("http://192.168.1.2:4319")).toThrow();
    expect(() => normalizeBridgeBaseUrl("https://bridge.example.com/v1/other")).toThrow();
  });

  test("discovers only real text-capable models, excludes auto and image/video", async () => {
    const paths: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      paths.push(url.pathname);
      expect(url.origin).toBe(bridgeConnection("custom").origin);
      return Response.json({ object: "list", data: [
        { id: "bridge-auto" }, { id: "bridge-chatgpt" }, { id: "bridge-gemini" },
        { id: "bridge-image", type: "image" }, { id: "bridge-video", outputKinds: ["video"] },
        { id: "custom-model", outputKinds: ["text"] },
      ] });
    }) as typeof fetch;
    const provider = await getAiBrTextProvider();
    expect(provider.id).toBe("aiBr");
    expect(provider.protocol).toBe("openai-completions");
    expect(provider.models.map(m => m.id)).toEqual(["bridge-chatgpt", "bridge-gemini", "custom-model"]);
    const models = await listAiModels();
    expect(models.some(m => m.providerId === "aiBr" && m.modelId === "bridge-chatgpt")).toBe(true);
    const configured = await getConfiguredModel("aiBr", "bridge-chatgpt");
    expect(configured.baseUrl).toEndWith("/v1");
    expect(configured.publicProviderId).toBe("aiBr");
    expect(paths.every(path => path === "/v1/models")).toBe(true);
  });

  test("never guesses text support from image/video-only model metadata", async () => {
    globalThis.fetch = (async () => Response.json({ data: [
      { id: "bridge-image", outputKinds: ["image"] },
      { id: "bridge-video", outputKinds: ["video"] },
    ] })) as typeof fetch;
    expect((await fetchAiBrModels()).every(model => !model.outputKinds.includes("text"))).toBe(true);
  });

  test("requires an explicitly pinned Cloud text model or exact live tab", async () => {
    const target = { profileInstanceId: randomUUID(), tabId: 42,
      documentToken: randomUUID(), url: "https://chatgpt.com/c/demo" };
    let hasPin = false;
    let stale = false;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path === "/v1/models") return Response.json({ data: [
        { id: "bridge-chatgpt", outputKinds: ["text"], pinned: hasPin },
      ] });
      if (path === "/api/bridge/status") return Response.json({ tabs: [{
        ...target, documentToken: stale ? randomUUID() : target.documentToken,
        provider: "chatgpt", ready: true, busy: false, outputKinds: ["text"],
      }] });
      throw new Error(`Unexpected request ${path}`);
    }) as typeof fetch;
    await expect(verifyAiBrTextTarget("bridge-chatgpt", undefined)).rejects.toThrow(/ghim model/);
    expect(calls).toEqual(["/v1/models"]);
    const value = JSON.stringify(Object.values(target));
    expect(await verifyAiBrTextTarget("bridge-chatgpt", value)).toEqual(target);
    stale = true;
    await expect(verifyAiBrTextTarget("bridge-chatgpt", value)).rejects.toThrow(/đổi phiên/);
    hasPin = true;
    expect(await verifyAiBrTextTarget("bridge-chatgpt", undefined)).toBeUndefined();
  });
});
