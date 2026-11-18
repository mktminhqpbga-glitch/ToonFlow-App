import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "@toonflow/file";
import { resolveWorkspacePath } from "@/utils/workspace/files";
import { detectMimeType } from "@/utils/media/priceReference";
import { chromeMimeTypes, type ChromeKind } from "./protocol";

export const chunkSize = 65536;
export const maxFileSize = 64 * 1024 * 1024;
export type ReferenceFile = { bytes: Uint8Array; mimeType: string; label: string };
export type ChromeResult = { kind: ChromeKind; bytes: Uint8Array; mimeType: string };
export function digest(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }
export function validateFile(bytes: Uint8Array, claimed: string, kind: ChromeKind) {
  const b = Buffer.from(bytes);
  if (!b.length || b.length > maxFileSize) throw new Error("Tệp Chrome trống hoặc vượt 64 MB.");
  if (kind === "text") {
    if (claimed !== "text/plain" || b.length > 1024 * 1024 || new TextDecoder("utf-8", { fatal: true }).decode(b).includes("\0")) throw new Error("Văn bản Chrome không hợp lệ hoặc vượt 1 MB.");
    return claimed;
  }
  const header = b.toString("ascii", 0, 16);
  const known = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || b[0] === 255 && b[1] === 216 && b[2] === 255
    || header.startsWith("RIFF") && ["WEBP", "WAVE"].includes(header.slice(8, 12))
    || header.slice(4, 8) === "ftyp" || b.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
    || /^(ID3|OggS|fLaC)/.test(header) || b[0] === 255 && ((b[1] ?? 0) & 224) === 224;
  const mime = detectMimeType(bytes, claimed);
  if (!known || !(chromeMimeTypes as readonly string[]).includes(mime) || mime !== claimed || !mime.startsWith(`${kind}/`)) throw new Error("Định dạng tệp không khớp đầu ra Chrome yêu cầu.");
  return mime;
}
export function frame(id: string, sequence: number, bytes: Uint8Array) {
  const header = Buffer.alloc(40); header.write(id, 0, 36, "ascii"); header.writeUInt32BE(sequence, 36);
  return Buffer.concat([header, bytes]);
}
export function newTransfer() { return randomUUID(); }
export async function readReferences(cwd: string, refs: { path: string; mimeType: string; label?: string }[], signal?: AbortSignal) {
  if (refs.length > 8) throw new Error("Tối đa 8 tệp tham chiếu.");
  const files: ReferenceFile[] = []; let size = 0;
  for (const [index, ref] of refs.entries()) {
    signal?.throwIfAborted();
    const { path } = await resolveWorkspacePath(cwd, ref.path); const info = await stat(path);
    if (!info.isFile() || info.size > maxFileSize || size + info.size > maxFileSize) throw new Error("Tổng tệp tham chiếu vượt 64 MB.");
    const bytes = await readFile(path, { signal }); size += bytes.length;
    if (size > maxFileSize) throw new Error("Tổng tệp tham chiếu vượt 64 MB.");
    const mimeType = detectMimeType(bytes, ref.mimeType); const kind = mimeType.split("/")[0];
    if (!["image", "video", "audio"].includes(kind)) throw new Error("Tham chiếu tệp cần là ảnh/video/audio; tài liệu phải được chuyển thành văn bản.");
    if (kind !== ref.mimeType.split("/")[0].toLowerCase()) throw new Error("Nội dung tệp tham chiếu không khớp loại ảnh/video/audio đã chọn.");
    validateFile(bytes, mimeType, kind as ChromeKind);
    files.push({ bytes, mimeType, label: ref.label ?? `Reference ${index + 1}` });
  }
  return files;
}
