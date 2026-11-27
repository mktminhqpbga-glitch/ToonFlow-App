import { z } from "@toonflow/nodes-scaffold/nodeTools";

export const clipForgeReceiptPath = ".macflowClipForge.json";
export const clipForgeImageLimit = 20 * 1024 * 1024;
const videoLimit = 100 * 1024 * 1024;
const remoteId = z.string().regex(/^[a-zA-Z0-9-]{1,128}$/);

const receiptSchema = z.object({
  version: z.literal(1), origin: z.string(), title: z.string().min(1).max(120),
  stage: z.enum(["preparing", "setupFailed", "awaiting", "accepted", "detached"]),
  projectId: remoteId.optional(), compositionId: remoteId.optional(),
  savedPath: z.string().regex(/^assets\/generated\/clipForge[0-9a-f-]{36}\.mp4$/).optional(),
  published: z.literal(true).optional(),
}).refine(value => (value.stage !== "awaiting" || !!value.projectId)
  && (value.stage !== "accepted" || (!!value.projectId && !!value.compositionId)));

export type ClipForgeReceipt = z.infer<typeof receiptSchema>;
export type ClipForgeOptions = {
  title: string; description: string; script: string; image: File;
  ratio: "9:16" | "16:9" | "1:1"; resolution: "720p" | "1080p"; voice: string;
};

export function clipForgeOrigin(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { throw new Error("Nhập địa chỉ ClipForge, ví dụ http://127.0.0.1:3457."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!(url.protocol === "https:" || (local && url.protocol === "http:")) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Dùng địa chỉ gốc HTTPS hoặc địa chỉ HTTP trên máy này, ví dụ http://127.0.0.1:3457.");
  }
  return url.origin;
}

export function parseClipForgeReceipt(text: string) {
  const receipt = receiptSchema.parse(JSON.parse(text));
  return { ...receipt, origin: clipForgeOrigin(receipt.origin) };
}

export function validateClipForgeImage(file: File) {
  if (!/\.(png|jpe?g|webp)$/i.test(file.name) || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size || file.size > clipForgeImageLimit) {
    throw new Error("Chọn ảnh sản phẩm PNG, JPEG hoặc WebP có dung lượng tối đa 20 MiB.");
  }
}

async function request<T>(origin: string, path: string, schema: z.ZodType<T>, signal: AbortSignal, method = "GET", body?: FormData | Record<string, unknown>) {
  let response: Response;
  const form = body instanceof FormData;
  try {
    response = await fetch(new URL(path, origin), {
      method, signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]), credentials: "omit", redirect: "error", cache: "no-store",
      headers: body && !form ? { "Content-Type": "application/json" } : undefined,
      body: form ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    signal.throwIfAborted();
    throw new Error(error instanceof DOMException && error.name === "TimeoutError" ? "ClipForge trả lời quá lâu."
      : "Không kết nối được ClipForge. Kiểm tra địa chỉ, dịch vụ đang chạy và cấu hình CORS.");
  }
  if (!response.ok) throw new Error(`ClipForge trả lỗi HTTP ${response.status}. Mở dự án ở ClipForge để xem chi tiết.`);
  const result = schema.safeParse(await response.json().catch(() => null));
  if (!result.success) throw new Error("ClipForge trả dữ liệu khác định dạng. Hãy kiểm tra phiên bản và địa chỉ máy chủ.");
  return result.data;
}

export async function checkClipForge(origin: string, signal: AbortSignal) {
  const health = await request(origin, "/api/health", z.object({
    version: z.string(), db: z.object({ status: z.string() }), paths: z.object({ dataDirWritable: z.boolean() }),
    ffmpeg: z.object({ exists: z.boolean().nullable() }),
  }), signal);
  if (health.db.status !== "ok" || !health.paths.dataDirWritable) throw new Error("ClipForge chưa sẵn sàng. Kiểm tra cơ sở dữ liệu và quyền ghi thư mục dữ liệu của dịch vụ.");
  if (health.ffmpeg.exists === false) throw new Error("ClipForge chưa tìm thấy FFmpeg để dựng video. Kiểm tra bản cài ClipForge.");
  return health.version;
}

export async function prepareClipForge(origin: string, options: ClipForgeOptions, signal: AbortSignal, onProject: (id: string) => Promise<void>) {
  const project = await request(origin, "/api/project", z.object({ id: remoteId }), signal, "POST", {
    name: options.title, productName: options.title, productDescription: options.description, videoMode: "product_closeup",
  });
  await onProject(project.id);
  const form = new FormData();
  form.append("projectId", project.id);
  form.append("files", options.image);
  const uploaded = await request(origin, "/api/upload", z.object({ paths: z.array(z.string()).length(1) }), signal, "POST", form);
  const photo = uploaded.paths[0];
  if (!photo || !new RegExp(`^/api/files/${project.id}/[a-zA-Z0-9-]+\\.(png|jpe?g|webp)$`, "i").test(photo)) {
    throw new Error("ClipForge trả đường dẫn ảnh sản phẩm không hợp lệ.");
  }
  await request(origin, `/api/project/${project.id}`, z.object({ id: remoteId }), signal, "PATCH", { productImages: [photo] });
  const script = await request(origin, `/api/project/${project.id}/import-script`, z.object({ scriptId: remoteId }), signal, "POST", { script: options.script, title: options.title });
  return { projectId: project.id, scriptId: script.scriptId };
}

export function composeClipForge(origin: string, projectId: string, scriptId: string, options: ClipForgeOptions, signal: AbortSignal) {
  return request(origin, `/api/project/${projectId}/compose`, z.object({ compositionId: remoteId }), signal, "POST", {
    scriptId, aspectRatio: options.ratio, resolution: options.resolution, captionPreset: "standard",
    freeTts: { enabled: !!options.voice, ...(options.voice ? { voice: options.voice } : {}) },
    aigcBadge: true, aigcBadgeText: "Nội dung do AI tạo", label: "MacFlow",
  });
}

export async function readClipForgeComposition(receipt: ClipForgeReceipt, signal: AbortSignal) {
  const { origin, projectId, compositionId } = receipt;
  if (!projectId) return null;
  const query = compositionId ? `?compositionId=${encodeURIComponent(compositionId)}` : "";
  const result = await request(origin, `/api/project/${projectId}/compose${query}`, z.object({ composition: z.object({
    id: remoteId, projectId: remoteId, status: z.enum(["pending", "composing", "done", "failed"]), url: z.string().nullish(),
  }).nullable() }), signal);
  const item = result.composition;
  if (!item) return null;
  if (item.projectId !== projectId || (compositionId && item.id !== compositionId)) throw new Error("Kết quả trả về thuộc tác vụ khác.");
  let videoUrl = "";
  let failedVoiceSegments = 0;
  if (item.status === "done") {
    if (!item.url || !new RegExp(`^/api/output/${projectId}/[a-zA-Z0-9_.%-]+\\.mp4$`, "i").test(item.url)) throw new Error("ClipForge chưa cung cấp đường dẫn MP4 cho tác vụ.");
    const filename = decodeURIComponent(item.url.split("/").at(-1)!);
    if (!/^[a-zA-Z0-9_.-]+\.mp4$/i.test(filename) || filename.startsWith(".")) throw new Error("Tên MP4 của ClipForge không hợp lệ.");
    videoUrl = new URL(item.url, origin).href;
    // A completed render can still be missing voice tracks. Older ClipForge versions may omit this metadata.
    const timeline = await request(origin, `${item.url}.timeline.json`,
      z.object({ warnings: z.array(z.object({ code: z.string() })).optional() }),
      AbortSignal.any([signal, AbortSignal.timeout(5000)])).catch(() => undefined);
    signal.throwIfAborted();
    failedVoiceSegments = timeline?.warnings?.filter(warning => warning.code === "tts_failed").length ?? 0;
  }
  return { id: item.id, status: item.status, videoUrl, failedVoiceSegments };
}

export async function downloadClipForgeMp4(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]), credentials: "omit", redirect: "error" });
  if (!response.ok || response.headers.get("content-type")?.split(";")[0]?.trim() !== "video/mp4" || !response.body) {
    throw new Error("ClipForge chưa trả tệp MP4 hợp lệ.");
  }
  if (Number(response.headers.get("content-length")) > videoLimit) throw new Error("MP4 vượt 100 MiB. Hãy dùng nút tải trực tiếp từ ClipForge.");
  const chunks: ArrayBuffer[] = [];
  const reader = response.body.getReader();
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > videoLimit) throw new Error("MP4 vượt 100 MiB. Hãy dùng nút tải trực tiếp từ ClipForge.");
      chunks.push(new Uint8Array(result.value).buffer);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const blob = new Blob(chunks, { type: "video/mp4" });
  const signature = await blob.slice(4, 8).text();
  if (signature !== "ftyp") throw new Error("Nội dung tệp ClipForge trả về không phải MP4.");
  return blob;
}
