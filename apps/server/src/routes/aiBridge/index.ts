/** MacFlow-only API client for independently installed AI-Bridge services. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Request } from "express";
import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { assertAppRequest } from "@/utils/mcp/control";
import conf from "@/utils/conf";
import { bridgeApiKey, bridgeConnection, configureBridgeKey, probeBridge, selectedBridgeSource, verifyCustomBridgeKey } from "@/utils/aiBridge/connection";
import { addMediaProvider, getMediaProvider } from "@/utils/media/provider";

const router = Router();
// The selected source stays pinned until the user explicitly connects a
// verified custom bridge; no source change happens on a failed verification.
let source = selectedBridgeSource();
let { origin, baseUrl } = bridgeConnection(source);
const localAddresses = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const localNames = new Set(["127.0.0.1", "localhost", "[::1]"]);
const hosts = {
  muse: ["muse.ai", "www.muse.ai"], chatgpt: ["chatgpt.com"], gemini: ["gemini.google.com"],
  claude: ["claude.ai"], grok: ["grok.com"], deepseek: ["chat.deepseek.com"],
  perplexity: ["www.perplexity.ai"], qwen: ["chat.qwen.ai", "chat.qwenlm.ai"],
  kimi: ["www.kimi.com"], zai: ["chat.z.ai"],
} as const;
const service = z.enum(Object.keys(hosts) as [keyof typeof hosts, ...(keyof typeof hosts)[]]);
const target = z.strictObject({
  profileInstanceId: z.uuid(), tabId: z.number().int().nonnegative(),
  documentToken: z.uuid(), url: z.url().max(2000),
});
const input = z.strictObject({
  model: z.string().max(40).regex(/^bridge-(?:muse|chatgpt|gemini|claude|grok|deepseek|perplexity|qwen|kimi|zai)$/),
  messages: z.array(z.strictObject({ role: z.enum(["user", "assistant"]), content: z.string().max(20000) })).min(1).max(40),
  target,
  media_kind: z.enum(["none", "auto", "image", "video"]).optional(),
  input_images: z.array(z.strictObject({
    mime_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
    data: z.string().min(16).max(6_990_508).regex(/^[A-Za-z0-9+/]+={0,2}$/),
    name: z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/).optional(),
  })).max(4).optional(),
});

const mediaTypes = new Set(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"]);
const maxMediaSize = 64 * 1024 * 1024;
function signatureMatches(buffer: Buffer, type: string): boolean {
  if (buffer.length < 12) return false;
  if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (type === "image/jpeg") return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (type === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (type === "video/mp4") return buffer.toString("ascii", 4, 8) === "ftyp";
  if (type === "video/webm") return buffer.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex"));
  return false;
}

function assertLocal(req: Request) {
  assertAppRequest(req);
  if (!localAddresses.has(req.socket.remoteAddress || "") || !localNames.has(req.hostname)
    || conf.get("settings", {}).multiTenantEnabled === true) {
    throw Object.assign(new Error("AI-Bridge chỉ cho phép sử dụng trong MacFlow cục bộ trên máy này."), { status: 403 });
  }
}
function key() {
  return bridgeApiKey(source);
}
async function fetchOriginal(path: string, options: { method?: string; data?: object; signal?: AbortSignal; timeout?: number } = {}) {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeout ?? 10000)]) : AbortSignal.timeout(options.timeout ?? 10000);
  const response = await fetch(`${origin}${path}`, {
    method: options.method || "GET", redirect: "error", signal,
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    ...(options.data ? { body: JSON.stringify(options.data) } : {}),
  });
  const body = await response.json() as { error?: { message?: string } } & Record<string, unknown>;
  if (!response.ok) throw Object.assign(new Error(body.error?.message || `AI-Bridge lỗi HTTP ${response.status}.`), { status: response.status });
  return body;
}
router.get("/status", async (req, res) => {
  assertLocal(req);
  const remote = await fetchOriginal("/api/bridge/status");
  res.set("Cache-Control", "no-store").json(success(remote));
});
router.get("/custom/status", async (req, res) => {
  assertLocal(req);
  const custom = bridgeConnection("custom");
  const response = await fetch(`${custom.origin}/api/bridge/status`, {
    headers: { Authorization: `Bearer ${bridgeApiKey("custom")}` },
    signal: AbortSignal.timeout(6500), redirect: "error",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw Object.assign(new Error(`AI-Bridge tùy chỉnh chưa xác thực được trạng thái tab (HTTP ${response.status}).`), { status: 503 });
  }
  const status = await response.json() as { tabs?: unknown };
  if (!Array.isArray(status.tabs)) throw Object.assign(new Error("AI-Bridge tùy chỉnh chưa có giao thức danh sách tab tương thích."), { status: 503 });
  res.set("Cache-Control", "no-store").json(success(status));
});
router.get("/sources", async (req, res) => {
  assertLocal(req);
  // Probe both installations read-only, without returning any credentials.
  const [original, custom] = await Promise.all([probeBridge("original"), probeBridge("custom")]);
  res.set("Cache-Control", "no-store").json(success({ active: source, original, custom }));
});
const connectSchema = z.strictObject({
  apiKey: z.string().trim().min(24).max(256).regex(/^[^\s]+$/).optional(),
});
let connecting = false;
async function installCustomMediaProvider(apiKey: string) {
  try {
    const installed = await getMediaProvider("aiBridgeLocal");
    // Never silently reuse an older imported adapter which can choose a
    // global tab or omit the explicit outputKinds guard. Keep user-modified
    // provider source intact and stop activation with a clear message.
    if (installed.version !== "0.6.0"
      || !installed.models.some(model => model.type === "image")
      || !installed.models.some(model => model.type === "video")
      || !installed.source.includes("pinned(request.other?.bridgeTarget)")
      || !installed.source.includes("outputKinds")) {
      throw Object.assign(new Error(
        "Adapter aiBridgeLocal đang cài đặt chưa tương thích với việc chọn tab an toàn. MacFlow chưa kích hoạt nguồn; cần cập nhật adapter trong Cài đặt → Mô hình media."), { status: 409 });
    }
  } catch (error) {
    // Preserve an already-installed custom provider. Only create a new one
    // when it does not exist; do not overwrite customized provider sources.
    if (!(error && typeof error === "object" && "status" in error && error.status === 404)) throw error;
    const paths = [
      join(process.cwd(), "research", "aiBridge.ts"),
      join(process.cwd(), "..", "..", "research", "aiBridge.ts"),
    ];
    let code: string | undefined;
    for (const path of paths) {
      code = await readFile(path, "utf8").catch(() => undefined);
      if (code) break;
    }
    if (!code) throw Object.assign(new Error("Chưa tìm thấy adapter AI-Bridge đã kiểm thử trong workspace."), { status: 503 });
    await addMediaProvider(code);
  }
  // The existing settings store writes 0600 and is already used for provider
  // credentials. Neither API response nor browser storage includes the key.
  const providerConfigs = conf.get("settings", {}).mediaProviderConfigs;
  const installed = providerConfigs && typeof providerConfigs === "object"
    && !Array.isArray(providerConfigs)
    ? (providerConfigs as Record<string, unknown>).aiBridgeLocal : undefined;
  const existing = installed && typeof installed === "object" && !Array.isArray(installed)
    ? installed as Record<string, unknown> : {};
  // Keep a user-selected pinned target and any other existing preferences;
  // never silently replace the user's Chrome tab during key configuration.
  conf.set("settings.mediaProviderConfigs.aiBridgeLocal", {
    ...existing,
    baseUrl: "http://127.0.0.1:4319/v1", apiKey,
  });
}
router.post("/connect", async (req, res) => {
  assertLocal(req);
  if (connecting) throw Object.assign(new Error("AI-Bridge đang kiểm tra kết nối. Vui lòng thử lại sau."), { status: 409 });
  const data = connectSchema.parse(req.body);
  const apiKey = data.apiKey ?? bridgeApiKey("custom");
  connecting = true;
  try {
    const check = await verifyCustomBridgeKey(apiKey);
    if (!check.apiOk) {
      res.set("Cache-Control", "no-store").json(success({
        saved: false, activated: false, ...check,
      }));
      return;
    }
    if (!check.mediaReady && source === "custom") {
      // A new but unready key must never replace credentials used by an
      // already-selected custom bridge. No effect on existing sessions.
      res.set("Cache-Control", "no-store").json(success({
        saved: false, activated: false, ...check,
        reason: `${check.reason} Giữ nguyên API Key đang hoạt động; không ghi đè bằng khóa mới khi tab chưa xác minh.`,
      }));
      return;
    }
    if (check.mediaReady) await installCustomMediaProvider(apiKey);
    // Save verified key even if the extension is not ready, so a future check
    // needs no re-entry. Preserve Original until media transport is verified.
    configureBridgeKey(apiKey, check.mediaReady);
    if (check.mediaReady) {
      source = "custom";
      ({ origin, baseUrl } = bridgeConnection("custom"));
    }
    res.set("Cache-Control", "no-store").json(success({
      saved: true, activated: check.mediaReady, ...check,
    }));
  } finally { connecting = false; }
});
// GET /v1 itself is deliberately not an API endpoint (404 is expected).
// Read-only diagnostics must never submit prompts or expose either bridge secret.
router.get("/diagnostics", async (req, res) => {
  assertLocal(req);
  const checks = await Promise.allSettled([
    fetch(`${origin}/health`, { redirect: "error", signal: AbortSignal.timeout(5000) }).then(async response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { ok?: boolean };
      if (body.ok !== true) throw new Error("Phản hồi health không hợp lệ");
      return true;
    }),
    fetchOriginal("/v1/models", { timeout: 5000 }).then(body => {
      if (!Array.isArray(body.data)) throw new Error("Danh sách model không hợp lệ");
      return body.data.length;
    }),
    fetchOriginal("/api/bridge/status", { timeout: 5000 }).then(body => ({
      connectedExtensions: typeof body.connected_extensions === "number" ? body.connected_extensions : 0,
      detectedTabs: Array.isArray(body.tabs) ? body.tabs.length : 0,
      sendReferenceImages: body.input_image_support === true && Array.isArray(body.tabs)
        && body.tabs.some(tab => !!tab && typeof tab === "object"
          && (tab as { ready?: boolean; input_image_support?: boolean }).ready === true
          && (tab as { input_image_support?: boolean }).input_image_support === true),
      readyMediaTabs: Array.isArray(body.tabs) && body.tabs.some(tab => !!tab && typeof tab === "object"
        && (tab as { ready?: boolean }).ready === true && (tab as { busy?: boolean }).busy === false
        && Array.isArray((tab as { outputKinds?: unknown }).outputKinds)
        && (tab as { outputKinds: string[] }).outputKinds.some(kind => kind === "image" || kind === "video")),
    })),
  ]);
  const health = checks[0]!;
  const models = checks[1]!;
  const status = checks[2]!;
  const hasMediaTab = status.status === "fulfilled" && status.value.readyMediaTabs;
  const hasAdapter = source === "original" || !!await getMediaProvider("aiBridgeLocal").catch(() => null);
  res.set("Cache-Control", "no-store").json(success({
    baseUrl,
    endpoints: { health: `${origin}/health`, models: `${baseUrl}/models`, chat: `${baseUrl}/chat/completions`, status: `${origin}/api/bridge/status` },
    baseUrlIsBrowsable: false,
    healthOk: health.status === "fulfilled",
    modelsOk: models.status === "fulfilled",
    modelCount: models.status === "fulfilled" ? models.value : 0,
    statusOk: status.status === "fulfilled",
    connectedExtensions: status.status === "fulfilled" ? status.value.connectedExtensions : 0,
    detectedTabs: status.status === "fulfilled" ? status.value.detectedTabs : 0,
    capabilities: {
      sendText: status.status === "fulfilled" && status.value.connectedExtensions > 0,
      receiveImageVideo: hasMediaTab,
      sendReferenceImages: hasMediaTab && status.status === "fulfilled" && status.value.sendReferenceImages,
      canvasNodeIntegration: hasMediaTab && hasAdapter,
    },
  }));
});
router.get("/config", (req, res) => {
  assertLocal(req);
  res.set("Cache-Control", "no-store").json(success({
    source, baseUrl,
    // MacFlow only consumes the external service API. No credentials or
    // extension pairing secrets are exposed to the browser, even for Original.
    apiKeyConfigured: (() => { try { return !!key(); } catch { return false; } })(),
    customKeySaved: !!conf.get("aiBridge")?.customApiKey,
  }));
});
// A browser image/video tag cannot attach the local bridge API key. Fetch via
// the authenticated MacFlow route, then create a temporary object URL in the UI.
router.get("/media/:id", async (req, res) => {
  assertLocal(req);
  const mediaId = z.uuid().parse(req.params.id);
  const remote = await fetch(`${origin}/v1/media/${mediaId}`, {
    redirect: "error", signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${key()}` },
  });
  if (!remote.ok) {
    const error = await remote.json().catch(() => null) as { error?: { message?: string } } | null;
    throw Object.assign(new Error(error?.error?.message || `Không tải được media (HTTP ${remote.status}).`), { status: remote.status });
  }
  const mediaType = remote.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  const declared = Number(remote.headers.get("content-length"));
  if (!mediaTypes.has(mediaType) || !Number.isSafeInteger(declared) || declared < 12 || declared > maxMediaSize) {
    await remote.body?.cancel();
    throw Object.assign(new Error("AI-Bridge trả về loại tệp hoặc dung lượng không hợp lệ."), { status: 502 });
  }
  const data = Buffer.from(await remote.arrayBuffer());
  if (data.length !== declared || !signatureMatches(data, mediaType))
    throw Object.assign(new Error("Dữ liệu ảnh/video không đạt kiểm tra an toàn."), { status: 502 });
  res.set({ "Content-Type": mediaType, "Content-Length": String(data.length),
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  res.status(200).end(data);
});
router.post("/chat", async (req, res) => {
  assertLocal(req);
  const payload = input.parse(req.body);
  const provider = service.parse(payload.model.slice("bridge-".length));
  const url = new URL(payload.target.url);
  if (url.protocol !== "https:" || !!url.username || !!url.password || !(hosts[provider] as readonly string[]).includes(url.hostname))
    throw Object.assign(new Error("Tab đã chọn không thuộc nhà cung cấp AI phù hợp."), { status: 400 });
  const requirePinnedTab = async () => {
    const status = await fetchOriginal("/api/bridge/status");
    const pinned = Array.isArray(status.tabs) ? status.tabs.find((tab: any) =>
      tab?.profileInstanceId === payload.target.profileInstanceId && tab.tabId === payload.target.tabId
      && tab.documentToken === payload.target.documentToken && tab.url === payload.target.url
      && tab.provider === provider && tab.ready === true && tab.busy === false) : null;
    if (!pinned) throw Object.assign(new Error("Tab AI-Bridge đã mất kết nối, F5 hoặc đang bận; chưa gửi prompt."), { status: 409 });
    const kind = payload.media_kind;
    if (kind === "image" || kind === "video") {
      if (!Array.isArray(pinned.outputKinds) || !pinned.outputKinds.includes(kind))
        throw Object.assign(new Error("Tab chưa xác nhận khả năng tạo ảnh/video được chọn; chưa gửi prompt."), { status: 409 });
      const extensions = status.extension_versions;
      const minMinor = source === "custom" ? 6 : 5;
      const count = status.connected_extensions;
      if (!Array.isArray(extensions) || !extensions.length || extensions.length !== count
        || !extensions.every((version: unknown) => {
          if (typeof version !== "string") return false;
          const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
          return !!match && (Number(match[1]) > 0 || Number(match[2]) >= minMinor);
        })) throw Object.assign(new Error("Chrome extension AI-Bridge chưa xác nhận phiên bản hỗ trợ media; chưa gửi prompt."), { status: 409 });
    }
    if (payload.input_images?.length && (pinned.input_image_support !== true || status.input_image_support !== true))
      throw Object.assign(new Error("Tab và máy chủ chưa xác nhận có thể nhận ảnh tham chiếu; chưa gửi prompt."), { status: 409 });
    return pinned;
  };
  // Read-only preflight for every request, not only those with references.
  // Never send to a stale tab or assume image/video capability from its name.
  await requirePinnedTab();
  if (payload.input_images?.length) {
    if (provider === "muse")
      throw Object.assign(new Error("Muse chưa xác minh được thao tác tải ảnh vào ô chat. Chưa gửi prompt."), { status: 409 });
    const maxImages = source === "custom" ? 4 : 2;
    const maxBytes = source === "custom" ? 16 * 1024 * 1024 : 3 * 1024 * 1024;
    const bytes = payload.input_images.map(item => Buffer.from(item.data, "base64"));
    if (!(["image", "video"] as string[]).includes(payload.media_kind ?? "none")
      || bytes.length > maxImages || bytes.reduce((total, item) => total + item.byteLength, 0) > maxBytes
      || bytes.some((item, index) => !item.length || item.length > (source === "custom" ? 5 : 3) * 1024 * 1024
        || item.toString("base64") !== payload.input_images![index]!.data
        || !signatureMatches(item, payload.input_images![index]!.mime_type)))
      throw Object.assign(new Error("Ảnh tham chiếu không đạt kiểm tra chữ ký, kích thước hoặc số lượng; chưa gửi prompt."), { status: 400 });
  }
  let imageIds: string[] | undefined;
  if (source === "custom" && payload.input_images?.length) {
    imageIds = [];
    for (const item of payload.input_images) {
      const bytes = Buffer.from(item.data, "base64");
      const expectedHash = createHash("sha256").update(bytes).digest("hex");
      const response = await fetch(`${origin}/v1/input-images`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${key()}`, "Content-Type": item.mime_type }, body: bytes,
      });
      const result = await response.json().catch(() => null) as {
        id?: string; mime_type?: string; size?: number; sha256?: string; error?: { message?: string };
      } | null;
      if (!response.ok || !result || !z.uuid().safeParse(result.id).success
        || result.mime_type !== item.mime_type || result.size !== bytes.length || result.sha256 !== expectedHash)
        throw Object.assign(new Error("AI-Bridge từ chối hoặc chưa xác nhận ảnh đã tải lên. Chưa gửi prompt."), { status: 409 });
      imageIds.push(result.id!);
    }
  }
  // Recheck after uploads (or just before a text/media POST) to minimize any
  // race with navigation, busy tabs, or a changed extension connection.
  await requirePinnedTab();
  // Every request has a fully pinned exact target. Never retry or choose an active tab.
  const result = await fetchOriginal("/v1/chat/completions", {
    method: "POST", timeout: 245000, data: {
      ...payload, stream: false,
      ...(imageIds ? { input_images: imageIds } : {}),
    },
    signal: AbortSignal.any([AbortSignal.timeout(245000)]),
  });
  res.set("Cache-Control", "no-store").json(success(result));
});
export default router;
