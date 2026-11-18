/**
 * Local AI-Bridge transport for Canvas media tasks.
 * Never guesses a tab, retries an uncertain submission or interprets
 * image_url text as an uploaded reference.
 */
import { createHash } from "node:crypto";
import type { MediaGenerationRequest, MediaModel, MediaReference } from "@toonflow/tools-scaffold/runtime";
import { detectMimeType } from "@/utils/media/priceReference";
import { bridgeApiKey, bridgeConnection, selectedBridgeSource } from "@/utils/aiBridge/connection";

const providers = {
  muse: ["muse.ai", "www.muse.ai"], chatgpt: ["chatgpt.com"], gemini: ["gemini.google.com"],
  claude: ["claude.ai"], grok: ["grok.com"], deepseek: ["chat.deepseek.com"],
  perplexity: ["www.perplexity.ai"], qwen: ["chat.qwen.ai", "chat.qwenlm.ai"],
  kimi: ["www.kimi.com"], zai: ["chat.z.ai"],
} as const;
type ProviderId = keyof typeof providers;
const providerNames: Record<ProviderId, string> = {
  muse: "Muse", chatgpt: "ChatGPT", gemini: "Gemini", claude: "Claude", grok: "Grok",
  deepseek: "DeepSeek", perplexity: "Perplexity", qwen: "Qwen", kimi: "Kimi", zai: "Z.ai",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxInputSize = 3 * 1024 * 1024;
const maxOutputSize = 64 * 1024 * 1024;
const inputMimes = new Set(["image/png", "image/jpeg", "image/webp"]);
const outputMimes = {
  image: new Set(["image/png", "image/jpeg", "image/webp"]),
  video: new Set(["video/mp4", "video/webm"]),
};
type BridgeTarget = { profileInstanceId: string; tabId: number; documentToken: string; url: string };
type BridgeTab = BridgeTarget & {
  provider: string; ready: boolean; busy: boolean; input_image_support?: boolean;
  /** Real output modes reported by the adapter, never inferred from provider name. */
  outputKinds?: ("text" | "image" | "video")[];
};
type BridgeStatus = { connected_extensions?: number; extension_versions?: string[]; tabs?: BridgeTab[]; input_image_support?: boolean };

function invalid(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
function bridgeKey(): string {
  const value = bridgeApiKey();
  if (value.length < 24) invalid("Khóa API AI-Bridge trên máy chưa hợp lệ.", 503);
  return value;
}
async function bridgeRequest(path: string, options: { method?: "GET" | "POST"; body?: object; signal?: AbortSignal; timeout?: number } = {}) {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeout ?? 5000)])
    : AbortSignal.timeout(options.timeout ?? 5000);
  const response = await fetch(`${bridgeConnection().origin}${path}`, {
    method: options.method ?? "GET", signal, redirect: "error",
    headers: { Authorization: `Bearer ${bridgeKey()}`, "Content-Type": "application/json" },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    invalid(details?.error?.message?.slice(0, 400) || `AI-Bridge trả HTTP ${response.status}.`, response.status);
  }
  return response;
}
function modernVersion(version: string, minMinor: number): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return !!match && (Number(match[1]) > 0 || Number(match[2]) >= minMinor);
}
async function bridgeStatus(signal?: AbortSignal): Promise<BridgeStatus> {
  const response = await bridgeRequest("/api/bridge/status", { signal, timeout: 4500 });
  return response.json() as Promise<BridgeStatus>;
}
export async function listBridgeMediaModels(): Promise<MediaModel[]> {
  // The custom 4319 installation has a distinct raw-upload-by-ID protocol.
  // Only its importable aiBridgeLocal.ts provider may handle it. Do not
  // advertise models through this legacy inline-base64 transport.
  if (selectedBridgeSource() === "custom") return [];
  let status: BridgeStatus;
  try { status = await bridgeStatus(); }
  catch { return []; } // AI-Bridge is optional and may be offline.
  if (!status.connected_extensions || !status.extension_versions?.some(version => modernVersion(version, 5))
    || !Array.isArray(status.tabs)) return [];
  const active = [...new Set(status.tabs.filter(tab => tab.ready && !tab.busy && Object.hasOwn(providers, tab.provider))
    .map(tab => tab.provider as ProviderId))];
  return active.flatMap(provider => (["image", "video"] as const).flatMap(type => {
    if (!status.tabs?.some(tab => tab.provider === provider && tab.ready && !tab.busy && tab.outputKinds?.includes(type)))
      return [];
    return [{
    providerId: "aiBridge", providerLabel: "AI-Bridge (Chrome)",
    modelId: provider, label: `${providerNames[provider]} · AI-Bridge (khả năng phụ thuộc tab)`,
    type, rules: [], supportsPrice: false,
    ...(type === "image" ? { imageRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] }
      : { mode: ["text", "singleImage", "startEndRequired"] }),
    } as MediaModel];
  }));
}
function parseTarget(raw: unknown, provider: ProviderId): BridgeTarget {
  let parsed: unknown;
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : null; }
  catch { invalid("Phiên AI-Bridge không hợp lệ; hãy chọn lại tab."); }
  if (!Array.isArray(parsed) || parsed.length !== 4 || !uuid.test(parsed[0]) || !Number.isSafeInteger(parsed[1])
    || parsed[1] < 0 || !uuid.test(parsed[2]) || typeof parsed[3] !== "string") invalid("Chưa chọn đúng Profile/tab AI-Bridge trong node.");
  const [profileInstanceId, tabId, documentToken, address] = parsed as [string, number, string, string];
  let url: URL;
  try { url = new URL(address); } catch { invalid("Địa chỉ tab AI-Bridge không hợp lệ."); }
  if (url.protocol !== "https:" || !!url.username || !!url.password || !providers[provider].some(host => host === url.hostname))
    invalid("Tab AI-Bridge không thuộc AI đã chọn.");
  return { profileInstanceId, tabId, documentToken, url: address };
}
function matchesTarget(left: BridgeTarget, right: BridgeTarget): boolean {
  return left.profileInstanceId === right.profileInstanceId && left.tabId === right.tabId
    && left.documentToken === right.documentToken && left.url === right.url;
}
type ReferenceImage = { mime_type: "image/png" | "image/jpeg" | "image/webp"; data: string; name: string };
export async function generateBridgeMedia(args: {
  directory: string;
  request: MediaGenerationRequest;
  kind: "image" | "video";
  signal?: AbortSignal;
  readReference: (directory: string, reference: MediaReference, kind: string, signal?: AbortSignal) => Promise<{ data: string; mimeType: string; name?: string }>;
  beforeSubmit: () => Promise<void>;
}): Promise<MediaAsset[]> {
  if (selectedBridgeSource() === "custom")
    invalid("Đường tạo ảnh/video của AI-Bridge tùy chỉnh cần nhà cung cấp aiBridgeLocal; không gửi bằng giao thức cũ.", 409);
  const { request, kind, directory, signal } = args;
  if (!Object.hasOwn(providers, request.modelId)) invalid("Mô hình AI-Bridge không hợp lệ.");
  const provider = request.modelId as ProviderId;
  const target = parseTarget((request.other as Record<string, unknown> | undefined)?.bridgeTarget, provider);
  const status = await bridgeStatus(signal);
  const tab = status.tabs?.find(tab => tab.provider === provider && matchesTarget(tab, target));
  if (!tab || !tab.ready || tab.busy || !tab.outputKinds?.includes(kind))
    invalid("Tab đã đổi phiên/đang bận hoặc chưa xác nhận hỗ trợ tạo ảnh/video; không gửi prompt.", 409);
  if (!status.extension_versions?.some(version => modernVersion(version, 5)))
    invalid("Chrome extension AI-Bridge chưa hỗ trợ nhận ảnh/video.", 409);
  if (request.videos?.length || request.audios?.length)
    invalid("AI-Bridge hiện chỉ hỗ trợ ảnh tham chiếu đầu vào, không hỗ trợ tệp video hoặc âm thanh.");
  const refs = [...request.images ?? [], ...request.firstFrame ? [request.firstFrame] : [],
    ...request.lastFrame ? [request.lastFrame] : []];
  if (refs.length > 2) invalid("AI-Bridge hỗ trợ tối đa 2 ảnh tham chiếu trong một yêu cầu.");
  if (refs.length && (provider === "muse" || status.input_image_support !== true || tab.input_image_support !== true
    || !status.extension_versions?.some(version => modernVersion(version, 6))))
    invalid("Tab AI-Bridge không xác nhận hỗ trợ tải ảnh đầu vào; chưa gửi prompt.", 409);
  const inputImages: ReferenceImage[] = [];
  let total = 0;
  for (const [index, reference] of refs.entries()) {
    signal?.throwIfAborted();
    const image = await args.readReference(directory, reference, "image", signal);
    if (!inputMimes.has(image.mimeType)) invalid("Ảnh đầu vào AI-Bridge phải là PNG/JPEG/WebP.");
    const bytes = Buffer.from(image.data, "base64");
    if (!bytes.length || bytes.length > maxInputSize || (total += bytes.length) > maxInputSize)
      invalid("Tổng ảnh tham chiếu AI-Bridge không được quá 3 MiB.");
    if (detectMimeType(bytes, image.mimeType) !== image.mimeType) invalid("Định dạng ảnh tham chiếu không khớp nội dung.");
    const ext = image.mimeType === "image/jpeg" ? "jpg" : image.mimeType.split("/")[1]!;
    inputImages.push({ mime_type: image.mimeType as ReferenceImage["mime_type"], data: image.data, name: `reference_${index + 1}.${ext}` });
  }
  const instructions = [
    request.ratio ? `Tỉ lệ khung hình: ${request.ratio}` : "",
    kind === "image" && request.size ? `Kích thước mong muốn: ${request.size}` : "",
    kind === "video" && request.duration ? `Thời lượng mong muốn: ${request.duration} giây` : "",
    kind === "video" && request.resolution ? `Độ phân giải mong muốn: ${request.resolution}` : "",
  ].filter(Boolean).join("; ");
  const prompt = request.prompt.trim() + (instructions ? `\n\nYêu cầu bổ sung: ${instructions}.` : "");
  // A POST can reach Chrome even if its HTTP response later fails. Save an
  // uncertain-submission checkpoint first; NEVER auto retry a resumed task.
  signal?.throwIfAborted();
  await args.beforeSubmit();
  const response = await bridgeRequest("/v1/chat/completions", {
    method: "POST", signal, timeout: 245000,
    body: {
      model: `bridge-${provider}`, target, media_kind: kind, stream: false,
      messages: [{ role: "user", content: prompt }],
      ...(inputImages.length ? { input_images: inputImages } : {}),
    },
  });
  const result = await response.json() as { media?: unknown };
  if (!Array.isArray(result.media) || !result.media.length || result.media.length > 4)
    invalid("AI-Bridge chưa trả ảnh/video được xác minh. Không tự gửi lại prompt.", 502);
  const output: MediaAsset[] = [];
  for (const item of result.media) {
    const file = item as { id?: string; mime_type?: string; sha256?: string; size?: number; kind?: string };
    if (file.kind !== kind || typeof file.id !== "string" || !uuid.test(file.id)
      || !outputMimes[kind].has(file.mime_type ?? "") || !/^[a-f0-9]{64}$/.test(file.sha256 ?? "")
      || !Number.isSafeInteger(file.size) || (file.size ?? 0) < 12 || (file.size ?? 0) > maxOutputSize)
      invalid("Metadata kết quả AI-Bridge không an toàn.", 502);
    const size = file.size!;
    const mimeType = file.mime_type!;
    const remote = await bridgeRequest(`/v1/media/${file.id}`, { signal, timeout: 30000 });
    const claimed = remote.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    const length = Number(remote.headers.get("content-length"));
    if (claimed !== mimeType || length !== size) invalid("Kết quả AI-Bridge không khớp MIME/dung lượng.", 502);
    const bytes = Buffer.from(await remote.arrayBuffer());
    if (bytes.byteLength !== size || createHash("sha256").update(bytes).digest("hex") !== file.sha256
      || detectMimeType(bytes, mimeType) !== mimeType)
      invalid("Ảnh/video từ AI-Bridge không khớp chữ ký hoặc SHA-256.", 502);
    output.push({ type: "binary", mediaType: kind, mimeType, data: bytes });
  }
  return output;
}
