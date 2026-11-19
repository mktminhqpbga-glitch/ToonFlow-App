import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { detectMimeType } from "@/utils/media/priceReference";
import type { ProviderTaskData } from "@toonflow/providers";
import type { VideoReference } from "@toonflow/tools-scaffold/runtime";
import { apiRequest, connectionKey, discoverMac2Api, getConnection, readBytes, readSmallJson } from "./connection";
import { checkpointSchema, imageMimeTypes, mac2ApiProviders, maxLegacyReferenceBytes, receiptSchema, type Mac2ApiCheckpoint,
  type Mac2ApiKind, type Mac2ApiModelCapability, type Mac2ApiProvider } from "./contract";

type Connection = NonNullable<ReturnType<typeof getConnection>>;
type Save = (checkpoint: ProviderTaskData) => Promise<void>;
type Input = (ImageRequest | VideoRequest) & { referenceOrder?: VideoReference[] };
type Slot = { image: number; video: number; retryAt: number };
const slots = new Map<string, Slot>();
const activeRequests = new Set<string>();
const definiteRejection = new Set([400, 401, 403, 404, 405, 409, 413, 415, 422, 429]);
const failedStates = ["failed", "cancelled", "canceled", "expired", "rejected"];
const pendingStates = ["queued", "pending", "running", "processing", "cancel_requested"];
const completedStates = ["completed", "succeeded", "success"];
const maxResultBytes = 100 * 1024 * 1024;

export class Mac2ApiRejected extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function terminal(status: string): never {
  throw Object.assign(new Error(`mac2API báo tác vụ ${status}. Kiểm tra tác vụ cũ trước khi tạo yêu cầu khác.`), { code: "MEDIA_TASK_FAILED" });
}
function object(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
}
function submitPath(kind: Mac2ApiKind) { return kind === "image" ? "/v1/images/tasks" : "/v1/videos"; }
function taskPath(checkpoint: Mac2ApiCheckpoint) { return `${submitPath(checkpoint.kind)}/${checkpoint.upstreamTaskId}`; }
function getConfiguredConnection(providerId: Mac2ApiProvider) {
  const connection = getConnection(providerId);
  if (!connection) throw new Mac2ApiRejected("Hãy lưu Base URL và khóa client m2c_ trong Cài đặt → Kết nối mac2API.");
  return connection;
}
function checkStoredConnection(checkpoint: Mac2ApiCheckpoint) {
  const connection = getConfiguredConnection(checkpoint.providerId);
  if (connection.baseUrl !== checkpoint.baseUrl || connectionKey(connection) !== checkpoint.credentialHash) {
    throw new Error("Kết nối mac2API đã đổi. Dùng lại kết nối gốc để tra cứu tác vụ này.");
  }
  return connection;
}

async function acquireSlot(connection: Connection, kind: Mac2ApiKind, limits: { perClientPending: number; perKindPending: number }, signal?: AbortSignal) {
  const key = connectionKey(connection);
  const slot = slots.get(key) ?? { image: 0, video: 0, retryAt: 0 };
  slots.set(key, slot);
  const deadline = Date.now() + 65 * 60_000;
  while (Date.now() < slot.retryAt || slot.image + slot.video >= limits.perClientPending || slot[kind] >= limits.perKindPending) {
    if (Date.now() >= deadline) throw new Mac2ApiRejected("Đã hết thời gian chờ chỗ trống trong hàng mac2API.", 429);
    await sleep(250, undefined, { signal });
  }
  signal?.throwIfAborted();
  // ACT: 单进程共享并发上限；其他 MacFlow 实例和未确认提交由 mac2API 的 429 保护。
  slot[kind]++;
  return { slot, release: () => { slot[kind]--; } };
}

function retrySeconds(header: string | null) {
  if (!header) return undefined;
  const seconds = /^\d+$/.test(header) ? Number(header) : Math.ceil((Date.parse(header) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function accepted(value: unknown, checkpoint: Mac2ApiCheckpoint) {
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success || parsed.data.kind && parsed.data.kind !== checkpoint.kind) {
    throw new Error("mac2API chưa trả biên nhận hợp lệ. Dùng mã yêu cầu đã lưu để tra cứu.");
  }
  return { ...checkpoint, stage: "accepted" as const, upstreamTaskId: parsed.data.task_id ?? parsed.data.id! };
}

function referenceImage(input: MediaInput, capability?: Mac2ApiModelCapability) {
  if (input.type === "url") throw new Mac2ApiRejected("Ảnh tham chiếu phải là tệp đã lưu trong workspace.");
  const bytes = input.type === "binary" ? Buffer.from(input.data) : Buffer.from(input.data, "base64");
  const mime = detectMimeType(bytes, "");
  if (!bytes.length || mime !== input.mimeType || !(capability?.allowedMimeTypes ?? imageMimeTypes).includes(mime)
    || bytes.length > (capability?.maxReferenceBytes ?? maxLegacyReferenceBytes)) {
    throw new Mac2ApiRejected("Ảnh tham chiếu không đúng loại hoặc vượt dung lượng mô hình hỗ trợ.");
  }
  return { bytes, mime };
}

function buildPayload(kind: Mac2ApiKind, input: Input, capability: Mac2ApiModelCapability | undefined, fallbackMaxReferences: number) {
  const video = input as VideoRequest;
  const image = input as ImageRequest;
  if (kind === "video" && (video.lastFrame || video.videos?.length || video.audios?.length || video.watermark !== undefined || video.generateAudio === false)) {
    throw new Mac2ApiRejected("Mô hình mac2API này chỉ nhận ảnh tham chiếu và dùng âm thanh mặc định.");
  }
  const first = kind === "video" ? video.firstFrame : undefined;
  const references = [...(first ? [first] : []), ...(input.images ?? [])];
  const maxRefs = capability?.maxReferences ?? fallbackMaxReferences;
  const modes = capability?.modes;
  if (references.length > maxRefs) throw new Mac2ApiRejected(`Mô hình nhận tối đa ${maxRefs} ảnh tham chiếu.`);
  if (modes?.length && (references.length === 0 ? !modes.includes("text")
    : references.length === 1 ? !modes.some(mode => ["singleImage", "multiReference", "startFrameOptional"].includes(mode) || mode.startsWith("imageReference:"))
      : !modes.some(mode => mode === "multiReference" || mode.startsWith("imageReference:")))) {
    throw new Mac2ApiRejected("Chế độ tham chiếu chưa được mô hình công bố hỗ trợ.");
  }
  const seen = new Map<string, number>();
  const images: string[] = [];
  const mapped = references.map(input => {
    const { bytes, mime } = referenceImage(input, capability);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const previous = seen.get(digest);
    if (previous !== undefined) return previous;
    images.push(`data:${mime};base64,${bytes.toString("base64")}`);
    seen.set(digest, images.length);
    return images.length;
  });
  if (images.reduce((sum, image) => sum + image.length, 0) > 32 * 1024 * 1024) {
    throw new Mac2ApiRejected("Tổng dữ liệu ảnh tham chiếu vượt giới hạn gửi.");
  }
  const prompt = input.prompt.replace(/\{\{ref (\d+)\}\}/g, (marker, number: string) => {
    const index = Number(number) - 1;
    const binding = input.referenceOrder?.[index];
    if (binding?.type === "text") return `tham chiếu ${number}`;
    const position = binding?.type === "firstFrame" ? (first ? 0 : -1)
      : binding?.type === "image" ? binding.index + (first ? 1 : 0) : input.referenceOrder ? -1 : index;
    if (mapped[position] === undefined) throw new Mac2ApiRejected(`Thiếu ảnh cho ${marker}.`);
    return `ảnh tham chiếu ${mapped[position]}`;
  });
  return JSON.stringify({
    model: input.model, prompt, ...(images.length ? { images } : {}), aspect_ratio: input.ratio,
    ...(kind === "video" ? { duration: video.duration, resolution: video.resolution } : { size: image.size, n: 1, response_format: "url" }),
  });
}

async function lookup(connection: Connection, checkpoint: Mac2ApiCheckpoint, signal?: AbortSignal) {
  const response = await apiRequest(connection, "/v1/tasks/by-request", { headers: { "Idempotency-Key": checkpoint.idempotencyKey } }, signal);
  if (!response.ok) { await response.body?.cancel(); return; }
  return accepted(await readSmallJson(response), checkpoint);
}

async function resultMedia(connection: Connection, kind: Mac2ApiKind, root: Record<string, unknown>, task: Record<string, unknown>, signal?: AbortSignal) {
  const result = object(task.result ?? root.result);
  const list = Array.isArray(result.data) ? result.data : Array.isArray(root.data) ? root.data : undefined;
  const item = object(list?.[0]);
  const address = item.url ?? task.url ?? result.url ?? (typeof result.filename === "string" ? `/v1/media/${encodeURIComponent(result.filename)}` : undefined);
  if (typeof address !== "string") throw new Error("mac2API báo xong nhưng thiếu địa chỉ tệp.");
  const url = new URL(address, `${connection.baseUrl}/`);
  const origin = new URL(connection.baseUrl).origin;
  if (url.origin !== origin || url.username || url.password || url.hash
    || !/^\/v1\/media\/[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/.test(url.pathname) || url.pathname.includes("..")) {
    throw new Error("Địa chỉ tệp trả về nằm ngoài kho media của mac2API đã cấu hình.");
  }
  const response = await apiRequest(connection, url.pathname + url.search, { headers: { Accept: `${kind}/*` } }, signal, 120000);
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Không tải được tệp mac2API (HTTP ${response.status}).`); }
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!mime?.startsWith(`${kind}/`)) { await response.body?.cancel(); throw new Error("Loại tệp mac2API không khớp với tác vụ."); }
  const bytes = await readBytes(response, maxResultBytes);
  if (detectMimeType(bytes, "") !== mime) throw new Error("Chữ ký tệp mac2API không khớp MIME.");
  return [{ type: "binary", mediaType: kind, data: new Uint8Array(bytes), mimeType: mime }] satisfies MediaAsset[];
}

async function poll(connection: Connection, checkpoint: Mac2ApiCheckpoint, signal?: AbortSignal): Promise<MediaAsset[]> {
  const deadline = Date.now() + 65 * 60_000;
  while (Date.now() < deadline) {
    const response = await apiRequest(connection, taskPath(checkpoint), undefined, signal);
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Không đọc được tác vụ mac2API (HTTP ${response.status}).`); }
    const root = object(await readSmallJson(response));
    const task = root.task ? object(root.task) : root;
    const status = String(task.status ?? task.state ?? "").toLowerCase();
    const id = task.task_id ?? task.id ?? root.task_id ?? root.id;
    if (id !== undefined && id !== checkpoint.upstreamTaskId) throw new Error("mac2API trả sai mã tác vụ.");
    if (completedStates.includes(status)) return resultMedia(connection, checkpoint.kind, root, task, signal);
    if (failedStates.includes(status)) terminal(status);
    if (!pendingStates.includes(status)) throw new Error("mac2API trả trạng thái tác vụ chưa được hỗ trợ.");
    await sleep(1800, undefined, { signal });
  }
  throw new Error("Đã hết thời gian theo dõi. Kiểm tra lại mã tác vụ đã lưu để tiếp tục.");
}

export async function generateMac2Api(providerId: Mac2ApiProvider, kind: Mac2ApiKind, localTaskId: string, input: Input, save: Save,
  signal?: AbortSignal) {
  const configured = mac2ApiProviders[providerId];
  if ((configured.models as Record<string, string>)[input.model] !== kind) throw new Mac2ApiRejected("Mô hình mac2API không hỗ trợ loại tác vụ này.");
  const connection = getConfiguredConnection(providerId);
  const discovery = await discoverMac2Api(connection);
  if (discovery.state === "unverified") throw new Mac2ApiRejected(
    discovery.httpStatus === 401 ? "Khóa client mac2API bị từ chối (HTTP 401)." : "Chưa xác minh được kết nối mac2API.", discovery.httpStatus ?? 503);
  if (!discovery.modelIds.includes(input.model)) throw new Mac2ApiRejected("Mô hình chưa xuất hiện trong danh sách mac2API.");
  const capability = discovery.capabilities?.models.find(model => model.id === input.model && model.provider === configured.upstream && model.type === kind);
  if (discovery.capabilities && !capability) throw new Mac2ApiRejected("Khả năng của mô hình mac2API không khớp catalog.");
  if (discovery.capabilities?.features.idempotency === false) throw new Mac2ApiRejected("Máy chủ chưa công bố hỗ trợ gửi tác vụ an toàn bằng khóa chống trùng.", 409);
  const payload = buildPayload(kind, input, capability, providerId === "mac2ApiMuse" ? 4 : 1);
  const requestIdentity = `${connectionKey(connection)}:${localTaskId}`;
  if (activeRequests.has(requestIdentity)) throw new Mac2ApiRejected("Mã yêu cầu này đang được gửi hoặc theo dõi.", 409);
  activeRequests.add(requestIdentity);
  let release = () => {};
  try {
    const admission = await acquireSlot(connection, kind, discovery.capabilities?.limits ?? { perClientPending: 2, perKindPending: 2 }, signal);
    release = admission.release;
    if (connectionKey(getConfiguredConnection(providerId)) !== connectionKey(connection)) {
      throw new Mac2ApiRejected("Kết nối mac2API đã đổi trong lúc chờ. Hãy kiểm tra cấu hình trước khi tạo lại.", 409);
    }
    const checkpoint: Mac2ApiCheckpoint = {
      transport: "mac2Api", providerId, kind, localTaskId, baseUrl: connection.baseUrl,
      idempotencyKey: localTaskId, credentialHash: connectionKey(connection),
      requestHash: createHash("sha256").update(payload).digest("hex"), stage: "prepared",
    };
    await save(checkpoint);
    signal?.throwIfAborted();
    let receipt: Mac2ApiCheckpoint | undefined;
    try {
      const response = await apiRequest(connection, submitPath(kind), {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": checkpoint.idempotencyKey }, body: payload,
      }, signal, 30000);
      if (response.ok) receipt = accepted(await readSmallJson(response), checkpoint);
      else {
        const seconds = retrySeconds(response.headers.get("retry-after"));
        await response.body?.cancel();
        if (response.status === 429) admission.slot.retryAt = Date.now() + Math.min(seconds ?? 2, 65 * 60) * 1000;
        if (definiteRejection.has(response.status)) throw new Mac2ApiRejected(
          response.status === 429 ? `mac2API đã từ chối vì hàng chờ đầy (HTTP 429).${seconds === undefined ? "" : ` Chờ ${seconds} giây trước khi gửi yêu cầu mới.`}`
            : `mac2API đã từ chối yêu cầu (HTTP ${response.status}).`, response.status);
      }
    } catch (cause) {
      if (cause instanceof Mac2ApiRejected) throw cause;
      signal?.throwIfAborted();
    }
    if (!receipt && discovery.capabilities?.features.lookupByRequestKey) {
      receipt = await lookup(connection, checkpoint, signal).catch(() => undefined);
    }
    if (!receipt) throw new Error("Chưa rõ mac2API đã nhận yêu cầu. Chỉ tra cứu mã đã lưu; không tự gửi lại.");
    await save(receipt);
    return await poll(connection, receipt, signal);
  } finally { release(); activeRequests.delete(requestIdentity); }
}

export async function resumeMac2Api(data: ProviderTaskData, localTaskId: string, save: Save, signal?: AbortSignal) {
  const checkpoint = checkpointSchema.parse(data);
  if (checkpoint.localTaskId !== localTaskId) throw new Error("Biên nhận mac2API không thuộc tác vụ này.");
  const connection = checkStoredConnection(checkpoint);
  if (checkpoint.upstreamTaskId) return poll(connection, checkpoint, signal);
  const discovery = await discoverMac2Api(connection, true);
  if (!discovery.capabilities?.features.lookupByRequestKey) throw new Error("Máy chủ chưa hỗ trợ tra cứu yêu cầu đã gửi.");
  const found = await lookup(connection, checkpoint, signal);
  if (!found) throw new Error("Chưa tìm thấy yêu cầu trên mac2API. Không tạo tác vụ mới.");
  await save(found);
  return poll(connection, found, signal);
}

export type Mac2ApiCancelState = "confirmed" | "requested" | "running" | "terminal" | "localOnly";

export async function cancelMac2Api(data: ProviderTaskData): Promise<Mac2ApiCancelState> {
  try {
    let checkpoint = checkpointSchema.parse(data);
    const connection = checkStoredConnection(checkpoint);
    const discovery = await discoverMac2Api(connection);
    const features = discovery.capabilities?.features;
    if (!features?.cancel) return "localOnly";
    if (!checkpoint.upstreamTaskId && features.lookupByRequestKey) checkpoint = await lookup(connection, checkpoint) ?? checkpoint;
    if (!checkpoint.upstreamTaskId) return "localOnly";
    const response = await apiRequest(connection, taskPath(checkpoint) + "/cancel", { method: "POST" });
    const body = object(await readSmallJson(response));
    if (response.status === 200 && body.task_id === checkpoint.upstreamTaskId && body.cancelled === true && body.status === "cancelled") return "confirmed";
    if (response.status === 202 && body.task_id === checkpoint.upstreamTaskId && body.cancelled === false && body.status === "cancel_requested") return "requested";
    const code = body.code ?? object(body.error).code;
    if (response.status === 409 && code === "CANNOT_CANCEL_RUNNING") return "running";
    if (response.status === 409 && code === "ALREADY_TERMINAL") return "terminal";
  } catch { /* ACT: Upstream cancellation is best-effort after durable local cancellation. */ }
  return "localOnly";
}
