import { z } from "@toonflow/nodes-scaffold/nodeTools";
import type useWorkspaceFiles from "@/lib/workspaceFiles";
import { fileErrorCode } from "./useVideoFlowRun";
import { contextLimit, imageByteLimit, imageExtensions, imageLimit, photoSchema, type FlowPhoto } from "./videoFlow";

export const productProfilesPath = ".macflowProductProfiles.json";
export const profileLimit = 40;
export const profilesMaxBytes = 4 * 1024 * 1024;
export const productProfileSchema = z.object({
  id: z.uuid(), name: z.string().trim().min(1).max(100),
  description: z.string().max(contextLimit), photos: z.array(photoSchema).max(imageLimit),
});
const librarySchema = z.object({ version: z.literal(1), profiles: z.array(productProfileSchema).max(profileLimit) })
  .refine(library => new Set(library.profiles.map(profile => profile.id)).size === library.profiles.length);
export type ProductProfile = z.infer<typeof productProfileSchema>;

export function readProductProfiles(text: string) {
  const parsed = librarySchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("Tệp hồ sơ sản phẩm không đúng định dạng.");
  return parsed.data.profiles;
}

export async function appendFlowPhotos(files: ReturnType<typeof useWorkspaceFiles>, picked: File[], target: FlowPhoto[], signal: AbortSignal) {
  if (picked.some(file => !Object.hasOwn(imageExtensions, file.type) || !file.size || file.size > imageByteLimit)) {
    throw new Error("Chọn ảnh JPEG, PNG, WebP, GIF hoặc AVIF tối đa 20 MiB mỗi tệp.");
  }
  await files.mkdir("assets", AbortSignal.any([signal, AbortSignal.timeout(15_000)])).catch(error => {
    if (fileErrorCode(error) !== "EEXIST") throw error;
  });
  for (const file of picked) {
    signal.throwIfAborted();
    const path = "assets/videoFlow" + crypto.randomUUID() + "." + imageExtensions[file.type];
    await files.write(path, file, true, AbortSignal.any([signal, AbortSignal.timeout(60_000)]));
    signal.throwIfAborted();
    target.push({ name: file.name.slice(0, 300), mimeType: file.type, bytes: file.size, path });
  }
}
