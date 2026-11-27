import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { createReadStream, createWriteStream, link, lstat, mkdir, open, readFile, unlink, writeAtomic } from "@toonflow/file";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { resolveWorkspacePath } from "@/utils/workspace/files";
import { detectMimeType } from "@/utils/media/priceReference";
import conf from "@/utils/conf";
import { getAssetsDirectory } from "./index";

const published = new Map<string, Promise<string>>();
const suffixes: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/ogg": "ogv" };
type VideoSource = { stream: Readable; size?: number; verify?: () => Promise<void> };
type LibraryFolder = "XuongVideo" | "VideoAFF";

async function exists(path: string) {
  return lstat(path).then(info => info.isFile() && !info.isSymbolicLink(), error => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
}

async function publish(folder: LibraryFolder, key: string, label: string, source: () => Promise<VideoSource>, restore: boolean) {
  const assets = await getAssetsDirectory();
  const receipts = join(dirname(conf.path), "generatedVideoReceipts");
  await mkdir(receipts, { recursive: true, mode: 0o700 });
  const info = await lstat(receipts);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Thư mục theo dõi Kho video không hợp lệ.");
  const receipt = join(receipts, key + ".txt");
  const saved = await readFile(receipt, "utf8").catch(error => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (saved && (!restore || await exists((await resolveWorkspacePath(assets, saved, true)).path))) return saved;

  const parent = (await resolveWorkspacePath(assets, folder)).path;
  await mkdir(parent, { recursive: true });
  const slug = (label.normalize("NFC").replace(/[^\p{L}\p{M}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "video");
  const temporary = (await resolveWorkspacePath(assets, `${folder}/.video-${randomUUID()}.tmp`)).path;
  try {
    const { stream, size, verify } = await source();
    await pipeline(stream, createWriteStream(temporary, { flags: "wx", mode: 0o600 }));
    const handle = await open(temporary, "r+");
    const header = Buffer.alloc(16);
    let length = 0;
    try {
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      length = bytesRead;
      if (size !== undefined && (await handle.stat()).size !== size) throw new Error("Video chưa tải đủ dữ liệu.");
      await handle.sync();
    } finally { await handle.close(); }
    const suffix = suffixes[detectMimeType(header.subarray(0, length), header.toString("ascii", 0, 4) === "OggS" ? "video/ogg" : "")];
    if (!suffix) throw new Error("Tệp kết quả không phải định dạng video được hỗ trợ.");
    await verify?.();
    const path = `${folder}/${slug}-${key.slice(0, 20)}.${suffix}`;
    const target = (await resolveWorkspacePath(assets, path)).path;
    await link(temporary, target).catch(async error => {
      if (error.code !== "EEXIST" || !await exists(target)) throw error;
    });
    await writeAtomic(receipt, path, { mode: 0o600 });
    return path;
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export function publishGeneratedVideo(folder: LibraryFolder, identity: string, label: string, source: () => Promise<VideoSource>, restore = false) {
  const key = createHash("sha256").update(JSON.stringify([folder, identity])).digest("hex");
  const active = published.get(key);
  if (active) return active;
  const pending = publish(folder, key, label, source, restore).finally(() => published.delete(key));
  published.set(key, pending);
  return pending;
}

export function publishWorkspaceVideo(directory: string, path: string, restore = false) {
  const name = path.split("/").at(-1)?.replace(/\.[^.]+$/, "") ?? "video";
  return publishGeneratedVideo("XuongVideo", JSON.stringify([directory, path]), name, async () => {
    const file = (await resolveWorkspacePath(directory, path)).path;
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || !info.size) throw new Error("Chưa có tệp video kết quả.");
    return { stream: createReadStream(file), size: info.size };
  }, restore);
}
