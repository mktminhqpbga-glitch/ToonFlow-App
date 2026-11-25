import express from "express";
import type { Request, Response } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { extname } from "node:path";
import { lstat, mkdir } from "@toonflow/file";
import { z } from "zod";
import u from "@/utils";
import { sendFile } from "@/utils/fileHttp";
import { supportsVideoReferenceOrder } from "@/utils/media/generation";
import { detectMimeType } from "@/utils/media/priceReference";

export const mediaTypes = new Map([
  ["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"],
  ["video/mp4", "mp4"], ["video/webm", "webm"], ["video/quicktime", "mov"],
  ["audio/mpeg", "mp3"], ["audio/wav", "wav"], ["audio/mp4", "m4a"],
]);
const maxBytes = 50 * 1024 * 1024;
const outputDirectory = "assets/huobaoGenerated";
const relativeStatic = /^\/static\/(?:[a-zA-Z0-9_-]+\/){0,5}[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]{2,5}$/;
const ratioSchema = z.string().regex(/^[1-9]\d{0,3}:[1-9]\d{0,3}$/);
type Selection = { providerId: string; modelId: string };
export type MediaConnection = { workspace: string; origin: string; publicUrl: string; apiBase: string; token: string };
type Media = { bytes: Buffer; mimeType: string };

function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }

function media(bytes: Uint8Array, hint = ""): Media {
  const mimeType = detectMimeType(bytes, hint);
  if (!bytes.byteLength || bytes.byteLength > maxBytes || !mediaTypes.has(mimeType)) fail("Tư liệu trống, vượt 50 MiB hoặc có định dạng chưa hỗ trợ.");
  return { bytes: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), mimeType };
}

export async function readHuobaoMedia(connection: Pick<MediaConnection, "origin" | "publicUrl">, input: string): Promise<Media> {
  let path = input.startsWith("static/") ? `/${input}` : input;
  if (!path.startsWith("/")) {
    const url = URL.parse(path);
    if (!url) fail("Đường dẫn tư liệu Huobao không hợp lệ.");
    if (![connection.origin, connection.publicUrl].includes(url.origin) || url.username || url.password || url.search || url.hash) {
      fail("Chỉ nhận tư liệu từ địa chỉ Huobao đang kết nối.");
    }
    path = url.pathname;
  }
  if (!relativeStatic.test(path)) fail("Dùng đường dẫn tệp tư liệu /static/ trong Huobao.");
  const response = await fetch(new URL(path, connection.origin), { redirect: "error", signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    fail("Không lấy được tệp Huobao hoặc tệp vượt 50 MiB.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maxBytes) fail("Tệp Huobao vượt 50 MiB.", 413);
      chunks.push(result.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return media(Buffer.concat(chunks, size));
}

export function getTransferMedia(bytes: Buffer) { return media(bytes); }

async function saveReference(connection: MediaConnection, file: Media, type: string) {
  if (!file.mimeType.startsWith(`${type}/`)) fail("Loại tư liệu Huobao khác với loại tham chiếu.");
  const path = `assets/huobaoReferences/${randomUUID()}.${mediaTypes.get(file.mimeType)}`;
  const directory = await u.workspaceFile.resolveWorkspacePath(connection.workspace, "assets/huobaoReferences", true);
  await mkdir(directory.path, { recursive: true });
  const target = await u.workspaceFile.resolveWorkspacePath(connection.workspace, path);
  await u.workspaceFile.writeWorkspaceFile(target.path, file.bytes, true);
  return { path, mimeType: file.mimeType };
}

const imageSchema = z.object({ model: z.string().min(1), prompt: z.string().trim().min(1).max(100000), size: z.string().max(50).optional(),
  n: z.coerce.number().int().min(1).max(1).optional() });
export const imageForm = express.raw({ type: "multipart/form-data", limit: "24mb" });
export async function generateImage(req: Request, res: Response, connection: MediaConnection, selection: Selection, alias: string) {
  const contentType = req.get("content-type") ?? "";
  const form = Buffer.isBuffer(req.body) && contentType.startsWith("multipart/form-data")
    ? await new globalThis.Response(new Uint8Array(req.body), { headers: { "content-type": contentType } }).formData() : undefined;
  const input = imageSchema.parse(form ? Object.fromEntries(form) : req.body);
  if (input.model !== alias) fail("Chọn mô hình ảnh MacFlow đã đăng ký.");
  const references = form?.getAll("image[]") ?? [];
  if (references.length > 9) fail("Huobao chỉ gửi được tối đa 9 ảnh tham chiếu.");
  const images = [];
  for (const reference of references) {
    if (typeof reference === "string") fail("Ảnh tham chiếu phải là tệp.");
    images.push(await saveReference(connection, media(new Uint8Array(await reference.arrayBuffer())), "image"));
  }
  const size = /^(\d{1,4})x(\d{1,4})$/i.exec(input.size ?? "");

  const model = (await u.mediaGeneration.listMediaModels()).find(item => item.type === "image" && item.providerId === selection.providerId && item.modelId === selection.modelId);
  if (!model) fail("Mô hình ảnh MacFlow đã chọn chưa sẵn sàng.", 503);
  const ratio = size && model.imageRatios?.find(candidate => {
    const [width, height] = candidate.split(":").map(Number);
    return Number(size[1]) * height! === Number(size[2]) * width!;
  });
  const params = u.mediaSchemas.imageGenerationSchema.parse({ ...selection, prompt: input.prompt, images, outputDirectory, ratio,
    size: model.imageSizes?.includes(input.size ?? "") ? input.size : undefined });
  const taskId = randomUUID();
  await u.mediaTasks.start(connection.workspace, taskId, "image", params, {}, null, true);
  res.json({ task_id: makeTicket(connection.token, "image", taskId) });
}

const mediaPart = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(100000) }),
  z.object({ type: z.literal("image_url"), image_url: z.object({ url: z.string().max(30 * 1024 * 1024) }) }),
  z.object({ type: z.literal("video_url"), video_url: z.object({ url: z.string().max(4096) }) }),
  z.object({ type: z.literal("audio_url"), audio_url: z.object({ url: z.string().max(22 * 1024 * 1024) }) }),
]);
type OutputType = "image" | "video";
function makeTicket(token: string, type: OutputType, id: string) {
  return `${id}.${createHmac("sha256", token).update(`huobao-${type}/${id}`).digest("base64url")}`;
}
function verifyTicket(token: string, type: OutputType, ticket: string) {
  const [id] = ticket.split(".");
  if (!z.uuid().safeParse(id).success) fail("Mã tác vụ Huobao không hợp lệ.", 404);
  const expected = Buffer.from(makeTicket(token, type, id!));
  const received = Buffer.from(ticket);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) fail("Mã tác vụ Huobao không hợp lệ.", 404);
  return id!;
}

export async function startVideo(req: Request, res: Response, connection: MediaConnection, selection: Selection, alias: string) {
  const input = z.object({
    model: z.literal(alias), content: z.array(mediaPart).min(1).max(16), ratio: ratioSchema.optional().or(z.literal("adaptive")),
    duration: z.number().int().positive().max(60).optional(), resolution: z.enum(["480p", "720p", "1080p", "2K"]).optional(),
    generate_audio: z.boolean().optional(),
  }).parse(req.body);
  const rawPrompt = input.content.flatMap(part => part.type === "text" ? [part.text] : []).join("\n").trim();
  if (!rawPrompt) fail("Nhập prompt cho video trong Huobao.");
  const model = (await u.mediaGeneration.listMediaModels()).find(item => item.type === "video" && item.providerId === selection.providerId && item.modelId === selection.modelId);
  if (!model) fail("Mô hình video MacFlow đã chọn chưa sẵn sàng.", 503);
  if (model.durationResolutionMap?.length && !model.durationResolutionMap.some(option =>
    (input.duration === undefined || option.duration.includes(input.duration)) &&
    (input.resolution === undefined || option.resolution.includes(input.resolution)))) {
    fail("Mô hình MacFlow đã chọn không hỗ trợ thời lượng hoặc độ phân giải này. Hãy chỉnh thông số phân cảnh trong Huobao.");
  }
  const images = [], videos = [], audios = [];
  for (const part of input.content) {
    if (part.type === "text") continue;
    const type = part.type === "image_url" ? "image" : part.type === "video_url" ? "video" : "audio";
    const url = part.type === "image_url" ? part.image_url.url : part.type === "video_url" ? part.video_url.url : part.audio_url.url;
    const data = /^data:(?:image\/(?:png|jpeg|webp)|audio\/(?:wav|mp3|mpeg));base64,([a-zA-Z0-9+/]+={0,2})$/.exec(url);
    const file = data ? media(Buffer.from(data[1]!, "base64")) : await readHuobaoMedia(connection, url);
    if (type === "image") images.push(await saveReference(connection, file, type));
    else if (type === "video") videos.push(await saveReference(connection, file, type));
    else audios.push(await saveReference(connection, file, type));
  }
  const referenceOrder = [
    ...images.map((_item, index) => ({ type: "image" as const, index })),
    ...videos.map((_item, index) => ({ type: "video" as const, index })),
    ...audios.map((_item, index) => ({ type: "audio" as const, index })),
  ];
  const mapped = supportsVideoReferenceOrder(selection.providerId);
  const prompt = rawPrompt.replace(/(@图片|音色参考音频)([1-9]\d*)/g, (_match, marker: string, position: string) => {
    const type = marker === "@图片" ? "image" : "audio";
    const index = referenceOrder.findIndex(item => item.type === type && item.index === Number(position) - 1);
    if (index < 0) fail("Mã tham chiếu trong prompt Huobao không có tư liệu tương ứng.");
    return mapped ? `{{ref ${index + 1}}} ` : `${type === "image" ? "ảnh tham chiếu" : "âm thanh tham chiếu"} ${position} `;
  });
  const params = u.mediaSchemas.videoGenerationSchema.parse({ ...selection, prompt, outputDirectory, images, videos, audios,
    ...(mapped && referenceOrder.length ? { referenceOrder } : {}),
    ratio: input.ratio === "adaptive" ? undefined : input.ratio, duration: input.duration, resolution: input.resolution,
    ...(model.audio === "optional" ? { generateAudio: input.generate_audio } : {}) });
  const id = randomUUID();
  await u.mediaTasks.start(connection.workspace, id, "video", params, {}, null, true);
  res.json({ id: makeTicket(connection.token, "video", id) });
}

async function mediaTask(connection: MediaConnection, type: OutputType, ticket: string) {
  const id = verifyTicket(connection.token, type, ticket);
  await u.mediaTasks.getStudioQueueStatus(connection.workspace, type);
  const [task] = await u.mediaTasks.status(connection.workspace, [id], true);
  const output = task?.result?.data?.find(file => file.mediaType === type && file.path.startsWith(`${outputDirectory}/`));
  return { task, output };
}

export async function pollMedia(res: Response, connection: MediaConnection, type: OutputType, ticket: string) {
  const { task, output } = await mediaTask(connection, type, ticket);
  if (output) {
    const url = `${connection.apiBase}/output/${type}/${ticket}/media${extname(output.path)}`;
    return res.json(type === "image" ? { status: "completed", image_url: url } : { status: "succeeded", content: { video_url: url } });
  }
  if (!task || ["failed", "interrupted", "cancelled"].includes(task.state)) {
    return res.json({ status: "failed", error: { message: "Tác vụ MacFlow chưa hoàn tất. Kiểm tra lịch sử và cấu hình mô hình trong MacFlow." } });
  }
  return res.json({ status: task.state === "queued" ? "queued" : "running" });
}

export async function downloadMedia(res: Response, connection: MediaConnection, type: OutputType, ticket: string, filename: string, next: (cause?: unknown) => void) {
  const { output } = await mediaTask(connection, type, ticket);
  if (!output || filename !== `media${extname(output.path)}`) fail("Tệp tư liệu Huobao chưa sẵn sàng.", 404);
  const { path } = await u.workspaceFile.resolveWorkspacePath(connection.workspace, output.path);
  if (!(await lstat(path)).isFile()) fail("Tệp tư liệu Huobao không còn tồn tại.", 404);
  res.type(output.mimeType);
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  await sendFile(res, path, {}, next);
}
