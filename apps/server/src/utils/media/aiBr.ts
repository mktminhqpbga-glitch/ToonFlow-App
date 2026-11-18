/** Built-in AI-Br Cloud media client. All requests use the configured local API gateway. */
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { MediaGenerationRequest, MediaModel, MediaReference } from "@toonflow/tools-scaffold/runtime";
import { bridgeApiKey, bridgeConnection } from "@/utils/aiBridge/connection";
import { fetchAiBrModels, type BrModel } from "@/utils/aiBridge/models";
import { detectMimeType } from "@/utils/media/priceReference";

type Kind = "image" | "video";
type Target = { profileInstanceId: string; tabId: number; documentToken: string; url: string };
type Status = Record<string, unknown>;
type MediaFile = { id: string; kind: Kind; mime_type: string; size: number; sha256: string };
type RunArgs = {
  directory: string;
  request: MediaGenerationRequest;
  kind: Kind;
  signal?: AbortSignal;
  readReference: (directory: string, reference: MediaReference, kind: string, signal?: AbortSignal) =>
    Promise<{ data: string; mimeType: string; name?: string }>;
  beforeSubmit: () => Promise<void>;
  saveTask: (data: Record<string, unknown>) => Promise<void>;
  resumeData?: Record<string, unknown>;
  clientRequestId: string;
};

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imageMimes = new Set(["image/png", "image/jpeg", "image/webp"]);
const outputMimes = { image: imageMimes, video: new Set(["video/mp4", "video/webm"]) };
const hosts: Record<string, string[]> = {
  muse: ["muse.ai", "www.muse.ai"], chatgpt: ["chatgpt.com"], gemini: ["gemini.google.com"],
  claude: ["claude.ai"], grok: ["grok.com"], deepseek: ["chat.deepseek.com"],
  perplexity: ["www.perplexity.ai"], qwen: ["chat.qwen.ai", "chat.qwenlm.ai"],
  kimi: ["www.kimi.com"], zai: ["chat.z.ai"],
};

function invalid(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function signalFor(signal: AbortSignal | undefined, ms: number): AbortSignal {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
}

function origin(): string {
  return bridgeConnection("custom").origin;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${bridgeApiKey("custom")}`, ...extra };
}

async function call(path: string, options: RequestInit = {}, signal?: AbortSignal, timeout = 8000): Promise<Response> {
  return fetch(`${origin()}${path}`, {
    ...options, headers: { ...headers(), ...options.headers }, signal: signalFor(signal, timeout),
    redirect: "error", cache: "no-store",
  });
}

async function bytesOf(response: Response, limit: number): Promise<Buffer> {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {
    await response.body?.cancel();
    invalid("AI-Br trả nội dung vượt giới hạn dung lượng.", 502);
  }
  if (!response.body) invalid("AI-Br trả dữ liệu trống.", 502);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) invalid("AI-Br trả nội dung vượt giới hạn dung lượng.", 502);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (length !== null && total !== Number(length)) invalid("AI-Br trả nội dung thiếu byte.", 502);
  return Buffer.concat(chunks, total);
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  const value = await bytesOf(response, 1_000_000);
  try { return record(JSON.parse(value.toString("utf8"))); }
  catch { return invalid("AI-Br trả JSON không hợp lệ.", 502); }
}

async function checked(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) {
    await response.body?.cancel();
    invalid(`AI-Br trả HTTP ${response.status}; kiểm tra dịch vụ trước khi thử lại.`, response.status);
  }
  return jsonOf(response);
}

async function statusOf(signal?: AbortSignal): Promise<Status> {
  return checked(await call("/api/bridge/status", {}, signal));
}

function tabRecords(status: Status): Record<string, unknown>[] {
  return Array.isArray(status.tabs) ? status.tabs.map(record) : [];
}

function pinnedModel(model: BrModel, status: Status): boolean {
  const item = Array.isArray(status.models) ? status.models.map(record).find(value =>
    value.id === model.id || value.model === model.id) : undefined;
  return model.pinned === true || item?.pinned === true;
}

function ready(status: Status, model: BrModel, kind: Kind): boolean {
  const modelStatus = Array.isArray(status.models) ? status.models.map(record).find(item =>
    item.id === model.id || item.model === model.id) : undefined;
  if (modelStatus && (modelStatus.ready === false
    || ["offline", "failed", "unavailable"].includes(String(modelStatus.status)))) return false;
  const serviceReady = modelStatus?.ready === true || modelStatus?.status === "ready" || status.ready === true
    || status.mediaReady === true || status.media_ready === true
    || status.state === "ready" || status.status === "ready";
  const provider = model.id.startsWith("bridge-") ? model.id.slice(7) : "";
  const tabReady = tabRecords(status).some(tab => tab.provider === provider && tab.ready === true
    && tab.busy === false && Array.isArray(tab.outputKinds) && tab.outputKinds.includes(kind));
  return tabReady || (pinnedModel(model, status) && serviceReady);
}

/** Only real model-declared capabilities with a verified ready backend are offered. */
export async function listAiBrMediaModels(): Promise<MediaModel[]> {
  try {
    const [models, status] = await Promise.all([fetchAiBrModels(), statusOf()]);
    return models.flatMap(model => (["image", "video"] as const).flatMap(type =>
      model.outputKinds.includes(type) && ready(status, model, type)
        ? [{ providerId: "aiBr", providerLabel: "AI-Br (Cloud API)", modelId: model.id,
          label: model.label, type, supportsPrice: false, rules: [],
          ...(type === "video" ? { mode: ["text", "singleImage"] } : {}) } satisfies MediaModel]
        : []));
  } catch {
    // An unavailable/older Cloud endpoint must never advertise media capability.
    return [];
  }
}

function targetFrom(raw: unknown): Target | undefined {
  if (raw === undefined || raw === null) return undefined;
  let value: unknown;
  try { value = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { invalid("Phiên tab AI-Br không hợp lệ; hãy chọn lại tab."); }
  if (Array.isArray(value) && value.length === 4) {
    value = { profileInstanceId: value[0], tabId: value[1], documentToken: value[2], url: value[3] };
  }
  const item = record(value);
  if (Object.keys(item).sort().join(",") !== "documentToken,profileInstanceId,tabId,url"
    || typeof item.profileInstanceId !== "string" || !uuidPattern.test(item.profileInstanceId)
    || !Number.isSafeInteger(item.tabId) || (item.tabId as number) < 0
    || typeof item.documentToken !== "string" || !uuidPattern.test(item.documentToken)
    || typeof item.url !== "string" || item.url.length > 2048) {
    invalid("Định danh Profile/tab/phiên AI-Br không hợp lệ.");
  }
  return item as Target;
}

function assertTarget(status: Status, target: Target | undefined, model: BrModel, kind: Kind): void {
  if (!target) {
    if (!pinnedModel(model, status)) invalid("Hãy chọn tab hoặc ghim model vào tab trong AI-Br trước khi gửi.", 409);
    return;
  }
  const tab = tabRecords(status).find(item =>
    item.profileInstanceId === target.profileInstanceId && item.tabId === target.tabId
    && item.documentToken === target.documentToken && item.url === target.url);
  if (!tab || tab.ready !== true || tab.busy !== false
    || !Array.isArray(tab.outputKinds) || !tab.outputKinds.includes(kind)) {
    invalid("Tab AI-Br đã đổi phiên, bận hoặc chưa hỗ trợ loại media; chưa gửi prompt.", 409);
  }
  const provider = String(tab.provider ?? "");
  let url: URL;
  try { url = new URL(target.url); }
  catch { invalid("Địa chỉ tab AI-Br không hợp lệ."); }
  if (url.protocol !== "https:" || url.username || url.password || !hosts[provider]?.includes(url.hostname)
    || (Object.hasOwn(hosts, model.id.slice(7)) && model.id !== `bridge-${provider}`)) {
    invalid("AI-Br không xác minh được provider và URL tab đã chọn.");
  }
}

function assertInputSupport(status: Status, target: Target | undefined): void {
  if (status.input_image_support !== true) {
    invalid("Máy chủ AI-Br chưa xác nhận hỗ trợ tải ảnh tham chiếu; chưa gửi prompt.", 409);
  }
  if (target) {
    const tab = tabRecords(status).find(item =>
      item.profileInstanceId === target.profileInstanceId && item.tabId === target.tabId
      && item.documentToken === target.documentToken && item.url === target.url);
    if (tab?.input_image_support !== true) {
      invalid("Tab AI-Br chưa xác nhận hỗ trợ tải ảnh tham chiếu; chưa gửi prompt.", 409);
    }
  }
}

function assertOptions(request: MediaGenerationRequest, kind: Kind): void {
  if (request.videos?.length || request.audios?.length || request.generateAudio === true
    || request.voice !== undefined || request.speed !== undefined || request.volume !== undefined
    || request.pitch !== undefined || request.language !== undefined || request.format !== undefined
    || request.sampleRate !== undefined || request.referenceOrder?.length) {
    invalid("AI-Br chưa hỗ trợ tùy chọn âm thanh, định dạng hoặc thứ tự tham chiếu này; chưa gửi prompt.");
  }
  if (kind === "image" && (request.mode !== undefined || request.duration !== undefined)) {
    invalid("AI-Br chưa hỗ trợ chế độ video hoặc thời lượng trong tác vụ ảnh.");
  }
  if (kind === "video") {
    if (request.firstFrame || request.lastFrame || request.size !== undefined
      || request.mode !== undefined && request.mode !== "text" && request.mode !== "singleImage") {
      invalid("AI-Br chưa xác minh chế độ video khung đầu/cuối hoặc các tùy chọn này; chưa gửi prompt.");
    }
    const imageCount = request.images?.length ?? 0;
    if ((request.mode === "singleImage" && imageCount !== 1)
      || (request.mode !== "singleImage" && imageCount > 0)) {
      invalid("Tạo video từ ảnh yêu cầu singleImage với đúng một ảnh; chưa gửi prompt.");
    }
    if (request.duration !== undefined && (!Number.isFinite(request.duration) || request.duration <= 0)) {
      invalid("Thời lượng video AI-Br không hợp lệ.");
    }
  }
}

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function assertSignature(data: Uint8Array, mime: string): boolean {
  return data.byteLength >= 12 && detectMimeType(data, "application/octet-stream") === mime;
}

async function uploadImage(data: Buffer, mime: string, signal?: AbortSignal): Promise<string> {
  const response = await call("/v1/input-images", { method: "POST",
    headers: { "Content-Type": mime }, body: data }, signal, 30000);
  const result = await checked(response);
  if (response.status !== 201 || typeof result.id !== "string" || !uuidPattern.test(result.id)
    || result.mime_type !== mime || result.size !== data.length || result.sha256 !== sha256(data)) {
    invalid("AI-Br chưa xác nhận đúng ảnh tải lên (MIME/SHA-256); chưa gửi prompt.", 502);
  }
  return result.id;
}

async function inputImageIds(args: RunArgs): Promise<string[]> {
  const refs = args.request.images ?? [];
  if (refs.length > 4) invalid("AI-Br chỉ nhận tối đa bốn ảnh tham chiếu.");
  const ids: string[] = [];
  let total = 0;
  for (const ref of refs) {
    args.signal?.throwIfAborted();
    const value = await args.readReference(args.directory, ref, "image", args.signal);
    if (!imageMimes.has(value.mimeType) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data)) {
      invalid("Ảnh đầu vào phải là PNG/JPEG/WebP với Base64 chính xác.");
    }
    if (value.data.length > Math.ceil(5 * 1024 * 1024 / 3) * 4) invalid("Ảnh tham chiếu vượt 5 MiB.");
    const data = Buffer.from(value.data, "base64");
    total += data.length;
    if (!data.length || data.length > 5 * 1024 * 1024 || total > 16 * 1024 * 1024
      || data.toString("base64") !== value.data || !assertSignature(data, value.mimeType)) {
      invalid("Ảnh tham chiếu sai định dạng hoặc vượt 5 MiB/ảnh, 16 MiB/tác vụ.");
    }
    ids.push(await uploadImage(data, value.mimeType, args.signal));
  }
  return ids;
}

function taskDetails(value: Record<string, unknown>) {
  const data = record(value.data);
  const task = record(value.task);
  return Object.keys(task).length ? task : Object.keys(data).length ? data : value;
}

function taskIdOf(value: Record<string, unknown>): string | undefined {
  const item = taskDetails(value);
  const id = item.id ?? item.task_id ?? item.taskId;
  return typeof id === "string" && idPattern.test(id) ? id : undefined;
}

function stageOf(value: Record<string, unknown>): "pending" | "completed" | "failed" {
  const task = taskDetails(value);
  const raw = task.status ?? task.state ?? (Array.isArray(task.media) || Array.isArray(value.media) ? "completed" : "");
  if (typeof raw !== "string") invalid("AI-Br trả trạng thái tác vụ không hợp lệ.", 502);
  const status = raw.toLowerCase();
  if (["queued", "pending", "submitted", "running", "processing", "in_progress", "in-progress",
    "unknown", "uncertain"].includes(status)) return "pending";
  if (["completed", "succeeded", "success", "done"].includes(status)) return "completed";
  if (["failed", "error", "cancelled", "canceled", "expired"].includes(status)) return "failed";
  return invalid("AI-Br trả trạng thái tác vụ chưa được hỗ trợ.", 502);
}

async function mediaFrom(value: Record<string, unknown>, kind: Kind, signal?: AbortSignal): Promise<MediaAsset[]> {
  const task = taskDetails(value);
  const files = Array.isArray(task.media) ? task.media : value.media;
  if (!Array.isArray(files) || files.length < 1 || files.length > 4) {
    invalid("AI-Br chưa trả kết quả media đã xác minh; không tự gửi lại prompt.", 502);
  }
  const output: MediaAsset[] = [];
  let total = 0;
  for (const raw of files) {
    const item = record(raw) as Partial<MediaFile>;
    if (item.kind !== kind || typeof item.id !== "string" || !uuidPattern.test(item.id)
      || typeof item.mime_type !== "string" || !outputMimes[kind].has(item.mime_type)
      || !Number.isSafeInteger(item.size) || (item.size ?? 0) < 12 || (item.size ?? 0) > 16 * 1024 * 1024
      || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(item.sha256)) {
      invalid("Metadata ảnh/video AI-Br không hợp lệ.", 502);
    }
    total += item.size!;
    if (total > 64 * 1024 * 1024) invalid("Tổng kết quả AI-Br vượt 64 MiB.", 502);
    const response = await call(`/v1/media/${item.id}`, {}, signal, 60000);
    if (!response.ok) return invalid(`AI-Br không tải được media HTTP ${response.status}; không gửi lại prompt.`, 502);
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    const declared = response.headers.get("content-length");
    if (mime !== item.mime_type || declared === null || !/^\d+$/.test(declared) || Number(declared) !== item.size) {
      await response.body?.cancel();
      invalid("MIME hoặc Content-Length của media AI-Br không khớp metadata.", 502);
    }
    const data = await bytesOf(response, 16 * 1024 * 1024);
    if (data.length !== item.size || !assertSignature(data, item.mime_type)
      || sha256(data) !== item.sha256.toLowerCase()) {
      invalid("Ảnh/video AI-Br không khớp chữ ký tệp hoặc SHA-256.", 502);
    }
    output.push({ type: "binary", mediaType: kind, mimeType: item.mime_type, data });
  }
  return output;
}

function endpointMissing(response: Response, body: Record<string, unknown>): boolean {
  if (response.status !== 404) return false;
  const error = record(body.error);
  const code = error.code;
  const message = String(error.message ?? body.message ?? "");
  return ["not_found", "route_not_found", "endpoint_not_found"].includes(String(code))
    && /route|endpoint|cannot post|not found/i.test(message)
    || /^cannot post \/v1\/media\/tasks$/i.test(message.trim());
}

async function readError(response: Response): Promise<Record<string, unknown>> {
  try { return await jsonOf(response); }
  catch { return {}; }
}

async function poll(args: RunArgs, id: string): Promise<MediaAsset[]> {
  const deadline = Date.now() + 20 * 60 * 1000;
  for (;;) {
    args.signal?.throwIfAborted();
    const response = await call(`/v1/media/tasks/${encodeURIComponent(id)}`, {}, args.signal, 15000);
    const state = await checked(response);
    const reportedId = taskIdOf(state);
    if (reportedId && reportedId !== id && reportedId !== args.clientRequestId) {
      invalid("AI-Br trả ID tác vụ không trùng với yêu cầu đã lưu.", 502);
    }
    const stage = stageOf(state);
    if (stage === "failed") invalid("AI-Br báo tác vụ thất bại hoặc đã hủy; không tự gửi lại prompt.", 502);
    if (stage === "completed") {
      await args.saveTask({ transport: "aiBr", stage: "completed", clientRequestId: args.clientRequestId,
        taskId: id, kind: args.kind, modelId: args.request.modelId });
      return mediaFrom(state, args.kind, args.signal);
    }
    if (Date.now() >= deadline) invalid("AI-Br vẫn đang xử lý; giữ ID tác vụ để tiếp tục kiểm tra, không gửi lại prompt.", 504);
    await delay(5000, undefined, { signal: args.signal });
  }
}

/**
 * Submit once. An uncertain HTTP result is only recoverable via GET and the
 * recorded request ID; it never triggers another POST.
 */
export async function generateAiBrMedia(args: RunArgs): Promise<MediaAsset[]> {
  const { request, kind, signal, clientRequestId } = args;
  if (request.providerId !== "aiBr" || !idPattern.test(request.modelId)
    || !idPattern.test(clientRequestId) || typeof request.prompt !== "string" || !request.prompt.trim()) {
    invalid("Mô hình, prompt hoặc mã tác vụ AI-Br không hợp lệ.");
  }
  if (args.resumeData) {
    const saved = args.resumeData;
    if (saved.transport !== "aiBr" || saved.clientRequestId !== clientRequestId
      || saved.kind !== kind || (saved.modelId !== undefined && saved.modelId !== request.modelId)) {
      invalid("Checkpoint AI-Br không thuộc yêu cầu hiện tại; không tự gửi lại prompt.", 409);
    }
    if (saved.stage === "syncSubmitting") {
      invalid("Lần gửi chat đồng bộ đã gián đoạn; không thể xác minh kết quả và không tự gửi lại.", 409);
    }
    const id = typeof saved.taskId === "string" && idPattern.test(saved.taskId) ? saved.taskId : clientRequestId;
    return poll(args, id);
  }
  signal?.throwIfAborted();
  const [models, status] = await Promise.all([fetchAiBrModels(signal), statusOf(signal)]);
  const selected: BrModel | undefined = models.find(item => item.id === request.modelId);
  if (!selected?.outputKinds.includes(kind) || !ready(status, selected, kind)) {
    invalid("Model AI-Br chưa công bố hỗ trợ tạo media hoặc Cloud chưa sẵn sàng.", 409);
  }
  if (request.other && Object.keys(request.other).some(field => field !== "bridgeTarget")) {
    invalid("AI-Br chưa xác nhận các tùy chọn khác ngoài bridgeTarget; chưa gửi prompt.");
  }
  const target = targetFrom(request.other?.bridgeTarget);
  assertOptions(request, kind);
  assertTarget(status, target, selected, kind);
  if (request.images?.length) assertInputSupport(status, target);
  const images = await inputImageIds(args);
  // A tab may navigate during uploads; always recheck its exact session before POST.
  if (target || images.length) {
    const fresh = await statusOf(signal);
    assertTarget(fresh, target, selected, kind);
    if (images.length) assertInputSupport(fresh, target);
  }
  const hints = [
    request.ratio ? `Tỷ lệ khung hình mong muốn: ${request.ratio}` : "",
    kind === "image" && request.size ? `Kích thước mong muốn: ${request.size}` : "",
    kind === "video" && request.resolution ? `Độ phân giải mong muốn: ${request.resolution}` : "",
    kind === "video" && request.duration ? `Thời lượng mong muốn: ${request.duration} giây` : "",
  ].filter(Boolean).join("; ");
  const prompt = request.prompt.trim() + (hints ? `\n\nYêu cầu bổ sung: ${hints}.` : "");
  const taskBody = { model: request.modelId, media_kind: kind, prompt,
    client_request_id: clientRequestId, ...(target ? { target } : {}),
    ...(kind === "video" && request.mode ? { mode: request.mode } : {}),
    ...(images.length ? { input_images: images } : {}) };
  signal?.throwIfAborted();
  await args.beforeSubmit();
  let response: Response;
  try {
    response = await call("/v1/media/tasks", { method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": clientRequestId },
      body: JSON.stringify(taskBody) }, signal, 245000);
  } catch {
    invalid("Chưa rõ AI-Br đã nhận tác vụ hay chưa; dùng mã yêu cầu đã lưu để kiểm tra lại, không tự gửi lại.", 502);
  }
  if (response.status === 404) {
    const error = await readError(response);
    if (!endpointMissing(response, error)) invalid("AI-Br trả 404 không xác định; không gửi tác vụ khác.", 502);
    await args.saveTask({ transport: "aiBr", stage: "syncSubmitting", clientRequestId, kind, modelId: request.modelId });
    const chat = await call("/v1/chat/completions", { method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": clientRequestId },
      body: JSON.stringify({ model: request.modelId, media_kind: kind, stream: false,
        client_request_id: clientRequestId, messages: [{ role: "user", content: prompt }],
        ...(kind === "video" && request.mode ? { mode: request.mode } : {}),
        ...(target ? { target } : {}), ...(images.length ? { input_images: images } : {}) }) }, signal, 245000);
    return mediaFrom(await checked(chat), kind, signal);
  }
  const accepted = await checked(response);
  const id = taskIdOf(accepted);
  if (!id) invalid("AI-Br đã phản hồi nhưng thiếu ID tác vụ; không gửi lại prompt.", 502);
  const stage = stageOf(accepted);
  await args.saveTask({ transport: "aiBr", stage: stage === "pending" ? "running" : stage,
    clientRequestId, taskId: id, kind, modelId: request.modelId });
  if (stage === "failed") invalid("AI-Br báo tác vụ thất bại; không gửi lại prompt.", 502);
  if (stage === "completed") return mediaFrom(accepted, kind, signal);
  return poll(args, id);
}
