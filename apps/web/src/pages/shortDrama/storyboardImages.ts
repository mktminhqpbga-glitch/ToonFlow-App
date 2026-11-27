import { createNodeRequestId, getNodeModelIdentity, type NodeMediaModel } from "@toonflow/nodes-scaffold/nodeAi";
import { z } from "@toonflow/nodes-scaffold/nodeTools";
import type useWorkspaceFiles from "@/lib/workspaceFiles";
import type { TextSnapshot } from "@/lib/workspaceFiles";
import { flowFileSchema, imageByteLimit, photoSchema, type MediaAttempt } from "@/pages/mediaStudio/videoFlow";
import { fileErrorCode } from "@/pages/mediaStudio/useVideoFlowRun";
import { sceneLimit } from "./shortDrama";

export const filmReferenceFolder = "assets/storyboardReferences";
export const filmReferencePath = ".macflowFilmReferences.json";
export const maxFilmReferences = 500;
export const imageDocumentLimit = 16 * 1024 * 1024;
export const imagePromptLimit = 10000;
const referenceName = z.string().min(1).max(80).regex(/^[^\[\]@\u0000-\u001f]+$/u);
const photoMime = z.enum(["image/png", "image/jpeg", "image/webp"]);
const filmPhoto = photoSchema.extend({
  name: referenceName,
  path: z.string().regex(/^assets\/storyboardReferences\/[0-9a-f-]{36}\.(png|jpg|webp)$/),
  mimeType: photoMime,
});
export const filmReferenceSchema = z.object({
  version: z.literal(1),
  photos: z.array(filmPhoto).max(maxFilmReferences),
}).refine(data => new Set(data.photos.map(photo => referenceKey(photo.name))).size === data.photos.length);
export type FilmReference = z.infer<typeof filmPhoto>;

const sceneImageFile = flowFileSchema.refine(file => file.mediaType === "image");
const storedRequest = z.object({
  mediaType: z.literal("image"), providerId: z.string().min(1).max(96), modelId: z.string().min(1).max(256),
  prompt: z.string().min(1).max(100000), ratio: z.string().max(32).optional(), size: z.string().max(64).optional(),
  images: z.array(filmPhoto.pick({ path: true, mimeType: true })).max(64).optional(),
});
const modeSelection = z.object({ model: z.string().max(512), ratio: z.string().max(32), size: z.string().max(64) });
const queuedScene = z.object({ id: z.uuid(), title: z.string().max(240), prompt: z.string().max(imagePromptLimit) });
const sceneProgress = z.object({
  state: z.enum(["queued", "running", "interrupted", "blocked", "error", "done"]),
  output: sceneImageFile.optional(), message: z.string().max(2000).optional(), canSkip: z.literal(true).optional(),
});
export const storyboardImageSchema = z.object({
  version: z.literal(1),
  selection: modeSelection,
  queue: z.array(queuedScene).max(sceneLimit),
  progress: z.record(z.uuid(), sceneProgress),
  active: z.object({ id: z.uuid(), request: storedRequest }).optional(),
}).refine(run => new Set(run.queue.map(scene => scene.id)).size === run.queue.length
  && (!run.active || run.queue.length > 0)
  && Object.keys(run.progress).length <= sceneLimit);
export type ImageRun = z.infer<typeof storyboardImageSchema>;
export type ImageSelection = z.infer<typeof modeSelection>;
export type QueuedScene = z.infer<typeof queuedScene>;

export function storyboardImagePath(boardId: string) {
  return `.macflowStoryboardImages.${boardId}.json`;
}

export function referenceNameOf(name: string) {
  return name.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function referenceKey(name: string) {
  return referenceNameOf(name).toLocaleLowerCase("vi");
}

const referenceTag = /(?<![\p{L}\p{M}\p{N}._%+@-])@(?:\[([^\]\r\n]{1,80})\]|([\p{L}\p{M}\p{N}_-]{1,80})(?![\p{L}\p{M}\p{N}_-]))/gu;
export function promptReferences(prompt: string) {
  const names = new Map<string, string>();
  let invalidName = false;
  const text = prompt.replace(referenceTag, (_tag, bracketed: string | undefined, short: string | undefined) => {
    const name = referenceNameOf(bracketed ?? short?.replaceAll("_", " ") ?? "");
    if (referenceName.safeParse(name).success) names.set(referenceKey(name), names.get(referenceKey(name)) ?? name);
    else invalidName = true;
    return name;
  });
  return { names, text: text.trim(), invalid: invalidName || prompt.replace(referenceTag, "").includes("@[") };
}

export function referenceAvailability(prompt: string, index: Map<string, FilmReference>, available: ReadonlySet<string>) {
  const parsed = promptReferences(prompt);
  const missing: string[] = [];
  const photos: FilmReference[] = [];
  for (const [key, name] of parsed.names) {
    const photo = index.get(key);
    if (!photo || !available.has(photo.path)) missing.push(name);
    else photos.push(photo);
  }
  return { ...parsed, missing, photos };
}

export function sceneImageRequest(text: string, photos: FilmReference[], model: NodeMediaModel, selection: ImageSelection): MediaAttempt["request"] & z.infer<typeof storedRequest> {
  const rawMode = model.mode;
  const modes = Array.isArray(rawMode) ? rawMode.flat().filter(value => typeof value === "string") : typeof rawMode === "string" ? [rawMode] : [];
  const limits = model.referenceLimits;
  const maximum = Math.min(64, limits?.maxReferences ?? (modes.includes("multiReference") ? 4 : modes.includes("singleImage") ? 1 : 0));
  if (photos.length > maximum) throw new Error(maximum
    ? `Mô hình nhận tối đa ${maximum} ảnh, cảnh đang gọi ${photos.length} ảnh. Hãy chọn mô hình phù hợp hoặc giảm ảnh.`
    : "Mô hình này chưa nhận ảnh tham chiếu. Hãy chọn mô hình khác.");
  if (!photos.length && modes.length && !modes.includes("text")) throw new Error("Mô hình này cần ảnh tham chiếu. Hãy thêm ảnh hoặc đổi mô hình.");
  const invalid = photos.find(photo => limits && (!limits.allowedMimeTypes.includes(photo.mimeType) || photo.bytes > limits.maxReferenceBytes));
  if (invalid) throw new Error(`Ảnh “${invalid.name}” vượt giới hạn định dạng hoặc dung lượng của mô hình.`);
  if (selection.ratio && !model.imageRatios?.includes(selection.ratio)) throw new Error("Chọn tỷ lệ khung hình mà mô hình hỗ trợ.");
  if (selection.size && !model.imageSizes?.includes(selection.size)) throw new Error("Chọn độ phân giải mà mô hình hỗ trợ.");
  const bindings = photos.map((photo, index) => `Ảnh ${index + 1} là tham chiếu cho “${photo.name}”.`).join("\n");
  return { mediaType: "image", ...getNodeModelIdentity(model),
    prompt: bindings ? `${text}\n\n${bindings}` : text,
    ...(photos.length ? { images: photos.map(({ path, mimeType }) => ({ path, mimeType })) } : {}),
    ...(selection.ratio ? { ratio: selection.ratio } : {}), ...(selection.size ? { size: selection.size } : {}),
  };
}

type Files = ReturnType<typeof useWorkspaceFiles>;
export async function readImageDocument(files: Files, path: string, limit: number, signal?: AbortSignal) {
  try { return await files.readTextSnapshot(path, { maxBytes: limit, signal }); }
  catch (error) { if (fileErrorCode(error) !== "ENOENT") throw error; }
}

export async function writeImageDocument(files: Files, path: string, data: unknown, limit: number, snapshot?: TextSnapshot) {
  const text = JSON.stringify(data);
  if (new Blob([text]).size > limit) throw new Error("Dữ liệu đã vượt giới hạn lưu của dự án.");
  const read = () => files.readTextSnapshot(path, { maxBytes: limit, signal: AbortSignal.timeout(12000) });
  try {
    if (snapshot) {
      const revision = await files.writeTextSnapshot(path, text, snapshot, AbortSignal.timeout(15000));
      return { ...snapshot, revision, text };
    }
    await files.write(path, text, true, AbortSignal.timeout(15000));
  } catch (error) {
    const confirmed = await read().catch(() => undefined);
    if (confirmed?.text === text) return confirmed;
    if (["ESTALE", "EEXIST"].includes(fileErrorCode(error) ?? "")) throw new Error("Dữ liệu đã thay đổi ở cửa sổ khác. Hãy tải lại để lấy bản mới nhất.");
    throw error;
  }
  const confirmed = await read();
  if (confirmed.text !== text) throw new Error("Dữ liệu đã thay đổi ở cửa sổ khác. Hãy tải lại để lấy bản mới nhất.");
  return confirmed;
}

export async function listFilmPhotos(files: Files, signal: AbortSignal) {
  try {
    const { entries } = await files.list(filmReferenceFolder, signal);
    return new Set(entries.filter(entry => entry.type === "file").map(entry => entry.path));
  } catch (error) {
    if (fileErrorCode(error) === "ENOENT") return new Set<string>();
    throw error;
  }
}

export async function saveFilmPhoto(files: Files, rawName: string, blob: Blob): Promise<FilmReference> {
  const name = referenceName.safeParse(referenceNameOf(rawName));
  if (!name.success) throw new Error("Nhập tên từ 1 đến 80 ký tự, tránh ký tự @ và dấu ngoặc vuông.");
  if (!blob.size || blob.size > imageByteLimit) throw new Error("Chọn một ảnh tối đa 20 MiB.");
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const signature = String.fromCharCode(...bytes);
  const format = signature.startsWith("\x89PNG\r\n\x1a\n") ? "png" : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "jpg"
    : signature.startsWith("RIFF") && signature.slice(8) === "WEBP" ? "webp" : "";
  if (!format) throw new Error("Chọn ảnh PNG, JPG hoặc WebP hợp lệ.");
  for (const folder of ["assets", filmReferenceFolder]) {
    try { await files.mkdir(folder, AbortSignal.timeout(12000)); }
    catch (error) { if (fileErrorCode(error) !== "EEXIST") throw error; }
  }
  const path = `${filmReferenceFolder}/${createNodeRequestId()}.${format}`;
  await files.write(path, blob, true);
  return { name: name.data, path, mimeType: format === "jpg" ? "image/jpeg" : `image/${format}`, bytes: blob.size };
}
