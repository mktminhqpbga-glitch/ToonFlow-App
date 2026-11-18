import { msg } from "@toonflow/i18n";
import { messageError } from "@toonflow/i18n/errors";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, chmod, lstat, mkdir, mkdtemp, realpath, rename, rm } from "@toonflow/file";
import { file } from "@toonflow/file/bun";
import { basename, dirname, join, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { builds, downloadSources } from "./catalog";
import { readVersionInWorker } from "./workerClient";

export { createFfmpeg } from "./runtime";
export { executeRemoteFfmpeg } from "./remote";
export { executeFfmpegInWorker, readVersionInWorker } from "./workerClient";
export type { BrowserFfmpegRequest, FfmpegRemoteEvent } from "./browserTypes";
export type * from "./types";
export { downloadSources };
export type SourceId = typeof downloadSources[number]["id"];
export type FfmpegMode = "auto" | "download" | "system";
export type DownloadState = {
  phase: "idle" | "downloading" | "verifying" | "installing" | "completed" | "error" | "cancelled";
  file?: string;
  received: number;
  total?: number;
  error?: string;
};

// OHOS Bun 目前报告 linux，宿主显式标识平台，避免下载不能运行的 Linux FFmpeg。
const platform = process.platform === "linux" && process.env.TOONFLOW_PLATFORM === "ohos" ? "ohos" : process.platform;
export const target = `${platform}-${process.arch}`;
// ACT: 上游尚无 Windows ARM64 包，复用 Windows 11 的 x64 仿真；有已校验原生包后再切换。
const downloadTarget = platform === "win32" && process.arch === "arm64" ? "win32-x64" : target;
export const build = Object.hasOwn(builds, downloadTarget) ? builds[downloadTarget as keyof typeof builds] : undefined;
const toolNames = ["ffmpeg", "ffprobe"] as const;

function executableName(name: string) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

export async function getToolStatus(directory: string, mode: FfmpegMode, formatError = (error: unknown) => error instanceof Error ? error.message : String(error)) {
  const entries = await Promise.all(toolNames.map(async (name) => {
    const downloaded = join(directory, executableName(name));
    const hasDownload = mode !== "system" && await file(downloaded).exists();
    const path = hasDownload ? downloaded : mode === "download" ? null : Bun.which(executableName(name));
    const origin = path ? hasDownload ? "download" as const : "system" as const : null;
    try {
      return [name, { path, origin, version: path ? await readVersionInWorker(path, name) : null, error: path ? null : "Không tìm thấy chương trình thực thi khả dụng" }] as const;
    } catch (error) {
      return [name, { path, origin, version: null, error: formatError(error) }] as const;
    }
  }));
  return Object.fromEntries(entries) as Record<typeof toolNames[number], typeof entries[number][1]>;
}

async function checkDirectory(path: string) {
  const stat = await lstat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw messageError(msg`Thư mục cài đặt phải là thư mục thông thường: ${path}`);
  return stat !== null;
}

export async function installFfmpeg(directory: string, sourceId: SourceId, signal: AbortSignal, report: (state: DownloadState) => void) {
  const source = downloadSources.find(item => item.id === sourceId);
  if (!source?.available) throw new Error("Nguồn tải này tạm thời không khả dụng; hãy chọn nguồn khác");
    if (!build) throw messageError(msg`Hiện chưa hỗ trợ tải tự động phiên bản ${target}`);
  signal = AbortSignal.any([signal, AbortSignal.timeout(15 * 60 * 1000)]);
  signal.throwIfAborted();
  const parent = dirname(resolve(directory));
  await checkDirectory(parent);
  await mkdir(parent, { recursive: true });
  const root = await realpath(parent);
  const destination = join(root, basename(directory));
  await checkDirectory(destination);
  const temporary = await mkdtemp(join(root, ".install-"));
  const staged = join(temporary, "bin");
  const previous = join(temporary, "previous");
  let preserveBackup = false;
  try {
    await mkdir(staged);
    for (const name of toolNames) {
      signal.throwIfAborted();
      const asset = build[name];
      report({ phase: "downloading", file: name, received: 0 });
      const response = await fetch(`${source.urlPrefix}${asset.fileName}`, { signal });
      if (!response.ok || !response.body) throw messageError(msg`${name} Tải xuống thất bại（HTTP ${response.status}）`);
      const total = Number(response.headers.get("content-length")) || undefined;
      let received = 0;
      const hash = createHash("sha256");
      const compressed = join(temporary, asset.fileName);
      await pipeline(Readable.from(response.body), new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          received += chunk.length;
          if (received > 128 * 1024 * 1024) return callback(new Error("Tệp tải xuống vượt quá dung lượng cho phép"));
          hash.update(chunk);
          report({ phase: "downloading", file: name, received, total });
          callback(null, chunk);
        },
      }), createWriteStream(compressed, { flags: "wx", signal }), { signal });
      report({ phase: "verifying", file: name, received, total });
      if (hash.digest("hex") !== asset.sha256) throw messageError(msg`${name} Kiểm tra tính toàn vẹn tệp thất bại; hãy đổi nguồn rồi thử lại`);
      const binary = join(staged, executableName(name));
      let extracted = 0;
      await pipeline(createReadStream(compressed, { signal }), createGunzip(), new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          extracted += chunk.length;
          callback(extracted > 256 * 1024 * 1024 ? new Error("Tệp giải nén vượt quá dung lượng cho phép") : null, chunk);
        },
      }), createWriteStream(binary, { flags: "wx", signal }), { signal });
      if (process.platform !== "win32") await chmod(binary, 0o755);
      await readVersionInWorker(binary, name, signal);
    }
    signal.throwIfAborted();
    // ACT: 两个程序验证完毕再整体替换；提交开始后不响应取消，避免留下半套程序。
    report({ phase: "installing", received: 0 });
    const existed = await checkDirectory(destination);
    if (existed) await rename(destination, previous);
    try {
      await rename(staged, destination);
    } catch (error) {
      if (existed) {
        try { await rename(previous, destination); }
        catch {
          preserveBackup = true;
          throw messageError(msg`Cài đặt thất bại và không thể khôi phục phiên bản trước; tệp cũ được giữ tại ${previous}`, { cause: error });
        }
      }
      throw error;
    }
  } finally {
    // 仅清理本次 mkdtemp 创建、且仍位于数据目录内的临时目录。
    if (!preserveBackup && dirname(temporary) === root) {
      await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(error => {
        console.warn(`Không thể dọn thư mục tạm FFmpeg: ${temporary}`, error);
      });
    }
  }
}
