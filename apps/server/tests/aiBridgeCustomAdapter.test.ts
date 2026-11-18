import { afterEach, describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateMediaProviderSource } from "../src/utils/media/provider";

const source = readFileSync(resolve(import.meta.dir, "../../../research/aiBridge.ts"), "utf8");
const transpiler = new Bun.Transpiler({ loader: "ts", target: "bun" });
const compiled = transpiler.transformSync(source);
const specifier = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const definition = (await import(specifier)).default as {
  id: string; models: { id: string; type: string }[];
  generateImage: (this: any, request: any) => Promise<any[]>;
  generateVideo: (this: any, request: any) => Promise<any[]>;
  resumeTask: (this: any, data: any) => Promise<any[]>;
};
const profileInstanceId = randomUUID();
const documentToken = randomUUID();
const mediaId = randomUUID();
const target = {
  profileInstanceId, tabId: 55, documentToken, url: "https://chatgpt.com/c/bridge-testing",
};
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
const mp4 = Buffer.from("000000186674797069736f6d0000000169736f6d", "hex");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Options = {
  kind?: "image" | "video";
  reference?: number;
  urlChanged?: boolean;
  busy?: boolean;
  oldExtension?: boolean;
  outputKinds?: ("image" | "video")[] | null;
  invalidKey?: boolean;
  uploadStatus?: number;
  wrongUploadHash?: boolean;
  outputMime?: string;
  downloadStatus?: number;
  wrongOutputHash?: boolean;
  disconnectOnChat?: boolean;
  timeoutOnChat?: boolean;
  disconnected?: boolean;
};
function fixture(options: Options = {}) {
  const kind = options.kind ?? "image";
  const output = kind === "image" ? png : mp4;
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const checkpoint: unknown[] = [];
  let seenStatus = 0;
  const apiKey = "test-local-api-key-do-not-log-0000000000";
  const fetcher: typeof fetch = (async (url: string, init: RequestInit = {}) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body;
    calls.push({ method, path: u.pathname, body });
    if (init.headers && (init.headers as Record<string,string>).Authorization !== `Bearer ${apiKey}`)
      throw new Error("Mock request was missing Bearer authentication");
    if (options.invalidKey) return Response.json({ error: { message: "Invalid credential" } }, { status: 401 });
    if (u.pathname === "/api/bridge/status") {
      if (options.disconnected) throw new Error("bridge offline");
      seenStatus++;
      return Response.json({
        connected_extensions: 1, extension_versions: [options.oldExtension ? "0.5.2" : "0.6.0"],
        tabs: [{ ...target,
          url: options.urlChanged ? "https://chatgpt.com/new-session" : target.url,
          provider: "chatgpt", ready: true, busy: options.busy || false,
          ...(options.outputKinds === null ? {} : { outputKinds: options.outputKinds ?? [kind] }),
        }],
      });
    }
    if (u.pathname === "/v1/models")
      return Response.json({ data: [{ id: "bridge-chatgpt" }] });
    if (u.pathname === "/v1/input-images") {
      if (options.uploadStatus) return Response.json({ error: "bad upload" }, { status: options.uploadStatus });
      const bytes = Buffer.from(body as Uint8Array);
      return Response.json({ id: randomUUID(), mime_type: "image/png", size: bytes.length,
        sha256: options.wrongUploadHash ? "0".repeat(64) : hash(bytes) }, { status: 201 });
    }
    if (u.pathname === "/v1/chat/completions") {
      if (options.disconnectOnChat) throw new Error("connection lost");
      if (options.timeoutOnChat) throw new DOMException("operation timed out", "TimeoutError");
      return Response.json({ media: [{
        id: mediaId, kind, mime_type: options.outputMime ?? (kind === "image" ? "image/png" : "video/mp4"),
        size: output.length, sha256: options.wrongOutputHash ? "0".repeat(64) : hash(output),
      }] });
    }
    if (u.pathname === `/v1/media/${mediaId}`) {
      if (options.downloadStatus) return Response.json({}, { status: options.downloadStatus });
      return new Response(output, { headers: {
        "Content-Type": kind === "image" ? "image/png" : "video/mp4",
        "Content-Length": String(output.length),
      } });
    }
    throw new Error("Unexpected fixture URL: " + u.pathname);
  }) as typeof fetch;
  const context = {
    config: { baseUrl: "http://127.0.0.1:4319/v1", apiKey, target: "" },
    tool: { fetch: fetcher },
    saveTaskData: async (value: unknown) => { checkpoint.push(value); },
  };
  const request: any = {
    model: kind, prompt: "Tạo nội dung mới", other: { bridgeTarget: JSON.stringify([
      target.profileInstanceId, target.tabId, target.documentToken, target.url,
    ]) },
    ...(options.reference ? { images: Array.from({ length: options.reference }, () => ({
      type: "base64", mimeType: "image/png", data: png.toString("base64"),
    })) } : {}),
    ...(kind === "video" ? { mode: options.reference ? "singleImage" : "text" } : {}),
  };
  const run = () => kind === "image" ? definition.generateImage.call(context, request)
    : definition.generateVideo.call(context, request);
  return { context, request, calls, checkpoint, run, kind, get seenStatus() { return seenStatus; },
    submitted: () => calls.filter(call => call.path === "/v1/chat/completions").length };
}
describe("AI-Bridge importable Toonflow provider v0.6.0 (fixture only)", () => {
  test("provider source parses and exports literal object without importing libraries", () => {
    const metadata = validateMediaProviderSource(source);
    expect(metadata.id).toBe("aiBridgeLocal");
    expect(definition.id).toBe("aiBridgeLocal");
    expect(metadata.models.map(item => item.type)).toEqual(["image", "video"]);
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).toContain("this.tool.fetch");
  });
  test("text to image returns checksum-verified binary media", async () => {
    const f = fixture();
    const files = await f.run();
    expect(f.submitted()).toBe(1);
    expect(files).toHaveLength(1);
    expect(files[0].type).toBe("binary");
    expect(files[0].mimeType).toBe("image/png");
    expect(Buffer.from(files[0].data)).toEqual(png);
  });
  test("image to image uploads raw bytes first and submits only uploaded IDs", async () => {
    const f = fixture({ reference: 1 });
    await f.run();
    expect(f.calls.findIndex(c => c.path === "/v1/input-images")).toBeLessThan(f.calls.findIndex(c => c.path === "/v1/chat/completions"));
    const sent = f.calls.find(c => c.path === "/v1/chat/completions")!.body as string;
    const json = JSON.parse(sent);
    expect(json.target).toEqual(target);
    expect(json.input_images).toHaveLength(1);
    expect(json.input_images[0]).toMatch(/^[a-f0-9-]{36}$/);
    expect(sent).not.toInclude("base64");
  });
  test("text to video returns real MP4 binary", async () => {
    const f = fixture({ kind: "video" });
    const files = await f.run();
    expect(files[0].mimeType).toBe("video/mp4");
    expect(Buffer.from(files[0].data)).toEqual(mp4);
  });
  test.each(["image", "video"] as const)("%s requires a tab selected inside its node, even with a stale global target", async kind => {
    const f = fixture({ kind });
    f.context.config.target = JSON.stringify([target.profileInstanceId, target.tabId, target.documentToken, target.url]);
    delete f.request.other;
    await expect(f.run()).rejects.toThrow(/ngay trong node MacFlow/);
    expect(f.calls).toHaveLength(0);
    expect(f.submitted()).toBe(0);
  });
  test("empty node tab never falls back to a configured global target", async () => {
    const f = fixture();
    f.context.config.target = JSON.stringify([target.profileInstanceId, target.tabId, target.documentToken, target.url]);
    f.request.other.bridgeTarget = "";
    await expect(f.run()).rejects.toThrow(/chọn lại tab/);
    expect(f.calls).toHaveLength(0);
  });
  test("image to video uploads and never drops the reference", async () => {
    const f = fixture({ kind: "video", reference: 1 });
    const files = await f.run();
    expect(files).toHaveLength(1);
    expect(f.calls.filter(c => c.path === "/v1/input-images")).toHaveLength(1);
    expect(JSON.parse(f.calls.find(c => c.path === "/v1/chat/completions")!.body as string).input_images).toHaveLength(1);
  });
  test("two image references preserve ordering and avoid sending raw base64 in chat", async () => {
    const f = fixture({ reference: 2 });
    await f.run();
    expect(f.calls.filter(c => c.path === "/v1/input-images")).toHaveLength(2);
    expect(JSON.parse(f.calls.find(c => c.path === "/v1/chat/completions")!.body as string).input_images).toHaveLength(2);
  });
  test.each([
    ["wrong Profile/tab/document or F5", { urlChanged: true }],
    ["busy tab", { busy: true }],
    ["old extension", { oldExtension: true }],
    ["tab without outputKinds", { outputKinds: null }],
    ["tab without requested output kind", { outputKinds: ["video" as const] }],
  ])("blocks %s before sending any prompt", async (_label, opts) => {
    const f = fixture(opts);
    await expect(f.run()).rejects.toThrow();
    expect(f.submitted()).toBe(0);
  });
  test("failed upload refuses text-only fallback", async () => {
    const f = fixture({ reference: 1, uploadStatus: 503 });
    await expect(f.run()).rejects.toThrow(/Tải ảnh tham chiếu thất bại/);
    expect(f.submitted()).toBe(0);
  });
  test("upload hash mismatch refuses to submit", async () => {
    const f = fixture({ reference: 1, wrongUploadHash: true });
    await expect(f.run()).rejects.toThrow(/không xác nhận đúng/);
    expect(f.submitted()).toBe(0);
  });
  test("output MIME mismatch is rejected", async () => {
    const f = fixture({ outputMime: "image/jpeg" });
    await expect(f.run()).rejects.toThrow(/MIME\/dung lượng/);
    expect(f.submitted()).toBe(1);
  });
  test("failed output download does not resend", async () => {
    const f = fixture({ downloadStatus: 503 });
    await expect(f.run()).rejects.toThrow(/Không tải được media/);
    expect(f.submitted()).toBe(1);
  });
  test("bad result checksum fails closed", async () => {
    const f = fixture({ wrongOutputHash: true });
    await expect(f.run()).rejects.toThrow(/SHA-256/);
    expect(f.submitted()).toBe(1);
  });
  test("connection loss after POST leaves uncertain state without auto-resend", async () => {
    const f = fixture({ disconnectOnChat: true });
    await expect(f.run()).rejects.toThrow(/Chưa biết AI có nhận prompt/);
    expect(f.submitted()).toBe(1);
    expect(f.checkpoint).toHaveLength(1);
    await expect(definition.resumeTask.call(f.context, f.checkpoint[0])).rejects.toThrow(/không gửi lại tự động/);
    expect(f.submitted()).toBe(1);
  });
  test("timeout after POST does not submit twice", async () => {
    const f = fixture({ timeoutOnChat: true });
    await expect(f.run()).rejects.toThrow(/Chưa biết AI có nhận prompt/);
    expect(f.submitted()).toBe(1);
  });
  test("bridge disconnected at preflight blocks before POST", async () => {
    const f = fixture({ disconnected: true });
    await expect(f.run()).rejects.toThrow();
    expect(f.submitted()).toBe(0);
  });
  test("invalid API key never transmits a prompt", async () => {
    const f = fixture({ invalidKey: true });
    await expect(f.run()).rejects.toThrow(/HTTP 401/);
    expect(f.submitted()).toBe(0);
  });
  test("errors never include API Key or Bridge Token", async () => {
    const f = fixture({ invalidKey: true });
    let message = "";
    try { await f.run(); } catch (e) { message = String(e); }
    expect(message).not.toContain(f.context.config.apiKey);
    expect(message).not.toMatch(/Bridge Token:\s*[A-Za-z0-9]/);
  });
});
