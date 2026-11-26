import { lstat, mkdir } from "@toonflow/file";
import { resolve } from "node:path";
import type { Request } from "express";
import { z } from "zod";
import u from "@/utils";
import { detectMimeType } from "@/utils/media/priceReference";

export const videoAffModels = ["writer", "review", "image", "video", "audio"] as const;
export type VideoAffModel = typeof videoAffModels[number];
export const selectionSchema = z.object({
  providerId: z.string().regex(/^[a-z][a-zA-Z0-9]{0,95}$/), modelId: z.string().trim().min(1).max(256),
}).refine(item => !["aiChrome", "toonflow"].includes(item.providerId));
export const modelSelections = z.record(z.enum(videoAffModels), selectionSchema.nullable());
export type ModelSelection = z.infer<typeof selectionSchema>;

export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

function origin(value: string) {
  const url = URL.parse(value);
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.hash || url.search) {
    fail("Địa chỉ VideoAFF phải là địa chỉ gốc HTTP hoặc HTTPS.", 503);
  }
  return url.origin;
}

export function videoAffOrigin() {
  return origin(process.env.TOONFLOW_VIDEO_AFF_ORIGIN || "http://127.0.0.1:8080");
}

export function videoAffPublicUrl() {
  return `${origin(process.env.TOONFLOW_VIDEO_AFF_PUBLIC_URL || "http://localhost:8080")}/dashboard/`;
}

export function videoAffToken() {
  const token = process.env.TOONFLOW_VIDEO_AFF_TOKEN;
  return token && /^[A-Za-z0-9_-]{32,256}$/.test(token) ? token : undefined;
}

export function videoAffCallback() {
  const value = URL.parse(process.env.TOONFLOW_VIDEO_AFF_CALLBACK || "http://127.0.0.1:3000/api/videoAff/bridge/v1");
  if (!value || origin(value.origin) !== value.origin || value.pathname !== "/api/videoAff/bridge/v1" ||
    value.username || value.password || value.search || value.hash) fail("Địa chỉ cầu nối VideoAFF không hợp lệ.", 503);
  return value.href;
}

export function configuredModels() {
  const config = modelSelections.safeParse(u.conf.get("videoAffModels"));
  return config.success ? config.data : { writer: null, review: null, image: null, video: null, audio: null };
}

export function modelFor(kind: VideoAffModel) {
  const value = configuredModels()[kind];
  if (!value) fail("Hãy chọn mô hình tương ứng trong mục VideoAFF của MacFlow.", 503);
  return value;
}

export async function videoAffWorkspace(req: Request) {
  const root = await u.workspace.getWorkspaceRoot(req);
  const directory = resolve(root, "videoAff");
  await mkdir(directory, { mode: 0o700 }).catch((cause: NodeJS.ErrnoException) => {
    if (cause.code !== "EEXIST") throw cause;
  });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) fail("Thư mục VideoAFF phải là một thư mục dự án thường.", 403);
  if (await u.workspace.resolveWorkspace(req, directory) !== directory) fail("Thư mục VideoAFF không hợp lệ.", 403);
  return directory;
}

const imageTypes = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"]]);
export const maxImageBytes = 10 * 1024 * 1024;
export const dataUrlSchema = z.string().max(Math.ceil(maxImageBytes / 3) * 4 + 40);

export function decodeImage(url: string) {
  const parsed = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
  if (!parsed || parsed[2]!.length % 4 !== 0) fail("VideoAFF yêu cầu ảnh PNG, JPEG hoặc WebP đính kèm.");
  const bytes = Buffer.from(parsed[2]!, "base64");
  if (bytes.length > maxImageBytes) fail("Ảnh VideoAFF vượt 10 MiB.", 413);
  const { mimeType, extension } = imageFormat(bytes);
  if (mimeType !== parsed[1]) fail("Định dạng ảnh VideoAFF không khớp nội dung.");
  return { bytes, mimeType, extension };
}

export function imageFormat(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > maxImageBytes) fail("Chọn ảnh PNG, JPEG hoặc WebP dưới 10 MiB.", 413);
  const mimeType = detectMimeType(bytes, "");
  const extension = imageTypes.get(mimeType);
  if (!extension) fail("Chọn ảnh PNG, JPEG hoặc WebP.", 415);
  return { mimeType, extension };
}
