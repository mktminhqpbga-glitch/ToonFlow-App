import { afterEach, describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import type { MediaGenerationRequest } from "@toonflow/tools-scaffold/runtime";
import { generateAiBrMedia, listAiBrMediaModels } from "../src/utils/media/aiBr";

const savedFetch = globalThis.fetch;
const savedKey = process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
const digest = createHash("sha256").update(png).digest("hex");
const imageId = randomUUID();
const serverTaskId = randomUUID();
const clientRequestId = randomUUID();
const tab = { profileInstanceId: randomUUID(), tabId: 25, documentToken: randomUUID(),
  url: "https://gemini.google.com/app", provider: "gemini", ready: true, busy: false,
  outputKinds: ["image", "video"] };

afterEach(() => {
  globalThis.fetch = savedFetch;
  if (savedKey === undefined) delete process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY;
  else process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY = savedKey;
});

type Captured = { path: string; method: string; headers: Headers; body: unknown };
type Setup = {
  models?: unknown[];
  status?: Record<string, unknown>;
  upload?: (body: Buffer) => Response;
  submit?: (body: Record<string, unknown>) => Response | Promise<Response>;
  poll?: () => Response;
  chat?: () => Response;
  media?: () => Response;
};
function setup(options: Setup = {}) {
  process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY = "test-key-only-123456789000";
  const calls: Captured[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const method = init?.method || "GET";
    const headers = new Headers(init?.headers);
    const bytes = init?.body ? Buffer.from(init.body as string | Uint8Array) : Buffer.alloc(0);
    const body = headers.get("content-type")?.includes("application/json") && bytes.length
      ? JSON.parse(bytes.toString("utf8")) as Record<string, unknown> : bytes;
    calls.push({ path, method, headers, body });
    if (path === "/v1/models") return Response.json({ data: options.models ?? [
      { id: "bridge-image", name: "AI-Br Cloud ảnh", outputKinds: ["image"], pinned: true },
      { id: "bridge-video", name: "AI-Br Cloud video", outputKinds: ["video"], pinned: true },
      { id: "bridge-gemini", outputKinds: ["text"] },
    ] });
    if (path === "/api/bridge/status") return Response.json(options.status ?? {
      ready: true, input_image_support: true, tabs: [{ ...tab, input_image_support: true }],
    });
    if (path === "/v1/input-images") return options.upload?.(bytes) ?? Response.json({
      id: imageId, mime_type: "image/png", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
    }, { status: 201 });
    if (path === "/v1/media/tasks" && method === "POST") return options.submit?.(body as Record<string, unknown>)
      ?? Response.json({ id: serverTaskId, status: "running" }, { status: 202 });
    if (path.startsWith("/v1/media/tasks/")) return options.poll?.()
      ?? Response.json({ id: path.split("/").at(-1), status: "completed", media: [
        { id: imageId, kind: "image", mime_type: "image/png", size: png.length, sha256: digest },
      ] });
    if (path === "/v1/chat/completions") return options.chat?.() ?? Response.json({
      media: [{ id: imageId, kind: "image", mime_type: "image/png", size: png.length, sha256: digest }],
    });
    if (path === `/v1/media/${imageId}`) return options.media?.() ?? new Response(png, {
      headers: { "Content-Type": "image/png", "Content-Length": String(png.length) },
    });
    throw new Error(`Unexpected test endpoint ${method} ${path}`);
  }) as typeof fetch;

  const request: MediaGenerationRequest = {
    providerId: "aiBr", modelId: "bridge-image", prompt: "Tạo ảnh minh họa",
  };
  let beforeSubmit = 0;
  const checkpoints: Record<string, unknown>[] = [];
  const run = (options: { resumeData?: Record<string, unknown>; request?: MediaGenerationRequest } = {}) =>
    generateAiBrMedia({
      directory: "/tmp", request: options.request ?? request, kind: "image", clientRequestId,
      resumeData: options.resumeData,
      readReference: async () => ({ data: png.toString("base64"), mimeType: "image/png" }),
      beforeSubmit: async () => { beforeSubmit++; },
      saveTask: async data => { checkpoints.push(data); },
    });
  return { calls, request, checkpoints, run, get submitted() { return beforeSubmit; } };
}

describe("AI-Br built-in Cloud media transport: mocked only; no paid prompts", () => {
  test("advertises only declared model media capabilities when Cloud is ready", async () => {
    setup();
    expect((await listAiBrMediaModels()).map(model => [model.providerId, model.modelId, model.type]))
      .toEqual([["aiBr", "bridge-image", "image"], ["aiBr", "bridge-video", "video"]]);
    setup({ status: { ready: false, tabs: [] } });
    expect(await listAiBrMediaModels()).toEqual([]);
    setup({ models: [{ id: "bridge-gemini", outputKinds: ["image"] }],
      status: { ready: true, models: [{ id: "bridge-gemini", ready: false }], tabs: [tab] } });
    expect(await listAiBrMediaModels()).toEqual([]);
    setup({ models: [{ id: "bridge-gemini", outputKinds: ["image"] }],
      status: { ready: true, tabs: [] } });
    expect(await listAiBrMediaModels()).toEqual([]);
    setup({ models: [{ id: "bridge-image", pinned: false, outputKinds: ["image"] }],
      status: { ready: true, tabs: [] } });
    expect(await listAiBrMediaModels()).toEqual([]);
    setup({ models: [{ id: "bridge-image", outputKinds: ["image"] }],
      status: { ready: true, models: [{ id: "bridge-image", pinned: true }], tabs: [] } });
    expect((await listAiBrMediaModels()).map(item => item.modelId)).toEqual(["bridge-image"]);
  });

  test("uploads raw reference with SHA, submits idempotent task once, polls and verifies image", async () => {
    const fake = setup();
    const result = await fake.run({ request: {
      ...fake.request, images: [{ path: "reference.png", mimeType: "image/png" }],
    } });
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("binary");
    expect(result[0]?.mimeType).toBe("image/png");
    expect(fake.submitted).toBe(1);
    const upload = fake.calls.find(call => call.path === "/v1/input-images")!;
    expect(upload.method).toBe("POST");
    expect(upload.headers.get("content-type")).toBe("image/png");
    expect(upload.body).toEqual(png);
    const submit = fake.calls.find(call => call.path === "/v1/media/tasks")!;
    expect(submit.headers.get("Idempotency-Key")).toBe(clientRequestId);
    expect(submit.body).toMatchObject({ client_request_id: clientRequestId, model: "bridge-image",
      media_kind: "image", input_images: [imageId] });
    expect(fake.calls.filter(call => call.path === "/v1/media/tasks")).toHaveLength(1);
    expect(fake.calls.some(call => call.path === `/v1/media/tasks/${serverTaskId}`)).toBe(true);
    expect(fake.checkpoints).toContainEqual(expect.objectContaining({
      transport: "aiBr", clientRequestId, taskId: serverTaskId, stage: "running",
    }));
  });

  test("resumes by stored task ID without uploading or submitting", async () => {
    const fake = setup();
    const output = await fake.run({ resumeData: {
      transport: "aiBr", stage: "running", clientRequestId, taskId: serverTaskId, kind: "image",
    } });
    expect(output).toHaveLength(1);
    expect(fake.submitted).toBe(0);
    expect(fake.calls.some(call => call.method === "POST")).toBe(false);
    expect(fake.calls.some(call => call.path === `/v1/media/tasks/${serverTaskId}`)).toBe(true);
  });

  test("uncertain POST is never resubmitted; checkpoint with request ID resumes by GET only", async () => {
    const fake = setup({ submit: async () => { throw new TypeError("simulated lost connection"); } });
    await expect(fake.run()).rejects.toThrow(/Chưa rõ AI-Br/);
    expect(fake.submitted).toBe(1);
    expect(fake.calls.filter(call => call.path === "/v1/media/tasks")).toHaveLength(1);
    const recovered = await fake.run({ resumeData: {
      transport: "aiBr", stage: "submitting", clientRequestId, kind: "image",
    } });
    expect(recovered).toHaveLength(1);
    expect(fake.submitted).toBe(1);
    expect(fake.calls.some(call => call.path === `/v1/media/tasks/${clientRequestId}`)).toBe(true);
  });

  test("unknown task stage stays recoverable and never causes a second POST", async () => {
    const fake = setup({ submit: () => Response.json({ id: serverTaskId, status: "unknown" }, { status: 202 }) });
    expect(await fake.run()).toHaveLength(1);
    expect(fake.calls.filter(call => call.path === "/v1/media/tasks")).toHaveLength(1);
    expect(fake.checkpoints).toContainEqual(expect.objectContaining({ stage: "running", taskId: serverTaskId }));
  });

  test("uses synchronous chat fallback only for explicit route-not-found 404", async () => {
    const fake = setup({ submit: () => Response.json({ error: { code: "not_found", message: "Route not found" } }, { status: 404 }) });
    expect(await fake.run()).toHaveLength(1);
    expect(fake.calls.filter(call => call.path === "/v1/chat/completions")).toHaveLength(1);
    expect(fake.checkpoints).toContainEqual(expect.objectContaining({ stage: "syncSubmitting" }));
    const blocked = setup({ submit: () => Response.json({ error: { code: "model_not_found", message: "Model missing" } }, { status: 404 }) });
    await expect(blocked.run()).rejects.toThrow(/404 không xác định/);
    expect(blocked.calls.some(call => call.path === "/v1/chat/completions")).toBe(false);
  });

  test("supports declared single-image video task with SHA-verified MP4 output", async () => {
    const mp4 = Buffer.from([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109]);
    const fake = setup({
      poll: () => Response.json({ id: serverTaskId, status: "completed", media: [{
        id: imageId, kind: "video", mime_type: "video/mp4", size: mp4.length,
        sha256: createHash("sha256").update(mp4).digest("hex"),
      }] }),
      media: () => new Response(mp4, {
        headers: { "Content-Type": "video/mp4", "Content-Length": String(mp4.length) },
      }),
    });
    let submits = 0;
    const result = await generateAiBrMedia({
      directory: "/tmp", request: {
        providerId: "aiBr", modelId: "bridge-video", prompt: "Tạo hoạt cảnh",
        mode: "singleImage", images: [{ path: "reference.png", mimeType: "image/png" }],
      }, kind: "video", clientRequestId,
      readReference: async () => ({ data: png.toString("base64"), mimeType: "image/png" }),
      beforeSubmit: async () => { submits++; }, saveTask: async () => {},
    });
    expect(submits).toBe(1);
    expect(result).toMatchObject([{ type: "binary", mediaType: "video", mimeType: "video/mp4" }]);
    expect(fake.calls.find(call => call.path === "/v1/media/tasks")?.body)
      .toMatchObject({ media_kind: "video", mode: "singleImage", input_images: [imageId] });
    expect(fake.calls.filter(call => call.path === "/v1/media/tasks")).toHaveLength(1);
  });

  test("wrong media checksum or unconfirmed upload stops without a second task POST", async () => {
    const badMedia = setup({ poll: () => Response.json({ id: serverTaskId, status: "completed",
      media: [{ id: imageId, kind: "image", mime_type: "image/png", size: png.length, sha256: "0".repeat(64) }],
    }) });
    await expect(badMedia.run()).rejects.toThrow(/SHA-256/);
    expect(badMedia.calls.filter(call => call.path === "/v1/media/tasks")).toHaveLength(1);
    const badUpload = setup({ upload: bytes => Response.json({
      id: imageId, mime_type: "image/png", size: bytes.length, sha256: "0".repeat(64),
    }, { status: 201 }) });
    await expect(badUpload.run({ request: { ...badUpload.request,
      images: [{ path: "ref.png", mimeType: "image/png" }] } })).rejects.toThrow(/SHA-256/);
    expect(badUpload.submitted).toBe(0);
  });

  test("does not accept stale or mismatched pinned browser tab", async () => {
    const fake = setup({ status: { ready: true, tabs: [{ ...tab, documentToken: randomUUID() }] } });
    await expect(fake.run({ request: {
      ...fake.request, other: { bridgeTarget: JSON.stringify([
        tab.profileInstanceId, tab.tabId, tab.documentToken, tab.url,
      ]) },
    } })).rejects.toThrow(/đổi phiên/);
    expect(fake.submitted).toBe(0);
  });

  test("requires explicit model pin, forbids unsupported video modes and image upload without capability", async () => {
    const unpinned = setup({ models: [{ id: "bridge-image", outputKinds: ["image"] }],
      status: { ready: true, tabs: [] } });
    await expect(unpinned.run()).rejects.toThrow(/chưa công bố hỗ trợ|Cloud chưa sẵn sàng/);
    expect(unpinned.submitted).toBe(0);

    const unsupportedVideo = setup();
    await expect(generateAiBrMedia({
      directory: "/tmp", request: { providerId: "aiBr", modelId: "bridge-video", prompt: "Tạo video",
        mode: "startEndRequired", firstFrame: { path: "a.png", mimeType: "image/png" } },
      kind: "video", clientRequestId, readReference: async () => ({
        data: png.toString("base64"), mimeType: "image/png",
      }), beforeSubmit: async () => { throw new Error("Unexpected submit"); }, saveTask: async () => {},
    })).rejects.toThrow(/khung đầu\/cuối/);
    expect(unsupportedVideo.calls.some(call => call.path === "/v1/input-images")).toBe(false);

    const noUploadCapability = setup({ status: { ready: true, tabs: [tab] } });
    await expect(noUploadCapability.run({ request: { ...noUploadCapability.request,
      images: [{ path: "ref.png", mimeType: "image/png" }] } }))
      .rejects.toThrow(/chưa xác nhận hỗ trợ tải ảnh/);
    expect(noUploadCapability.calls.some(call => call.path === "/v1/input-images")).toBe(false);
    expect(noUploadCapability.submitted).toBe(0);
  });
});
