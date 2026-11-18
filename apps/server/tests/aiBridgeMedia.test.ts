import { afterEach, describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { generateBridgeMedia, listBridgeMediaModels } from "../src/utils/media/aiBridge";
import type { MediaGenerationRequest } from "@toonflow/tools-scaffold/runtime";

const profile = randomUUID(), documentToken = randomUUID(), mediaId = randomUUID();
const target = { profileInstanceId: profile, tabId: 42, documentToken, url: "https://gemini.google.com/app" };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
const beforeFetch = globalThis.fetch;
const beforeKey = process.env.MACFLOW_AI_BRIDGE_API_KEY;
afterEach(() => {
  globalThis.fetch = beforeFetch;
  if (beforeKey === undefined) delete process.env.MACFLOW_AI_BRIDGE_API_KEY;
  else process.env.MACFLOW_AI_BRIDGE_API_KEY = beforeKey;
});
type Setup = { reference?: boolean; stale?: boolean; badHash?: boolean; unsupported?: boolean };
function setup(opts: Setup = {}) {
  process.env.MACFLOW_AI_BRIDGE_API_KEY = "local-test-key-only-1234567890";
  const calls: { path: string; body?: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ path, body });
    if (path === "/api/bridge/status") return Response.json({
      input_image_support: true, connected_extensions: 1, extension_versions: ["0.6.0"],
      tabs: [{ ...target, provider: "gemini", ready: !opts.stale, busy: false,
        outputKinds: ["image", "video"],
        input_image_support: !opts.unsupported }],
    });
    if (path === "/v1/chat/completions") return Response.json({
      media: [{ id: mediaId, kind: "image", mime_type: "image/png", size: png.length,
        sha256: opts.badHash ? "0".repeat(64) : createHash("sha256").update(png).digest("hex") }],
    });
    if (path === `/v1/media/${mediaId}`) return new Response(png, {
      headers: { "content-type": "image/png", "content-length": String(png.length) },
    });
    throw new Error("Unexpected test request");
  }) as typeof fetch;
  const request = {
    providerId: "aiBridge", modelId: "gemini", prompt: "Vẽ theo ảnh",
    other: { bridgeTarget: JSON.stringify([profile, 42, documentToken, target.url]) },
    ...(opts.reference ? { images: [{ path: "ref.png", mimeType: "image/png" }] } : {}),
  } as MediaGenerationRequest;
  let submitted = 0;
  return {
    calls, request, get submitted() { return submitted; },
    run: () => generateBridgeMedia({ directory: "/tmp", request, kind: "image",
      readReference: async () => ({ data: png.toString("base64"), mimeType: "image/png", name: "ref.png" }),
      beforeSubmit: async () => { submitted++; },
    }),
  };
}
describe("Canvas AI-Bridge transport (stubbed only, no real web AI prompts)", () => {
  test("discovers only live provider models from local tab inventory", async () => {
    setup();
    const models = await listBridgeMediaModels();
    expect(models.map(item => [item.providerId, item.modelId, item.type])).toEqual([
      ["aiBridge", "gemini", "image"], ["aiBridge", "gemini", "video"],
    ]);
  });
  test("sends reference bytes to exact pinned tab and imports SHA-verified binary output", async () => {
    const fake = setup({ reference: true });
    const results = await fake.run();
    expect(fake.submitted).toBe(1);
    expect(results).toHaveLength(1);
    expect(results[0]!.type).toBe("binary");
    expect(fake.calls.filter(item => item.path === "/v1/chat/completions")).toHaveLength(1);
    const sent = fake.calls.find(item => item.path === "/v1/chat/completions")!.body!;
    expect(sent.target).toEqual(target);
    expect((sent.input_images as { data: string }[])[0]?.data).toBe(png.toString("base64"));
  });
  test("stale Profile/tab/document blocks before submission", async () => {
    const fake = setup({ stale: true });
    await expect(fake.run()).rejects.toThrow(/đổi phiên/);
    expect(fake.submitted).toBe(0);
    expect(fake.calls.some(item => item.path === "/v1/chat/completions")).toBe(false);
  });
  test("unverified input upload blocks before submission, no text-only fallback", async () => {
    const fake = setup({ reference: true, unsupported: true });
    await expect(fake.run()).rejects.toThrow(/không xác nhận hỗ trợ/);
    expect(fake.submitted).toBe(0);
  });
  test("mismatched SHA refuses media after one submission without retry", async () => {
    const fake = setup({ badHash: true });
    await expect(fake.run()).rejects.toThrow(/SHA-256/);
    expect(fake.submitted).toBe(1);
    expect(fake.calls.filter(item => item.path === "/v1/chat/completions")).toHaveLength(1);
  });
});
