import { constants, copyFile, lstat, mkdir, open, realpath, rename, unlink, writeAtomic } from "@toonflow/file";
import { randomUUID } from "node:crypto";
import { delimiter, extname, join } from "node:path";
import { z } from "zod";
import { prepareWorkspaceFfmpeg } from "@/utils/ffmpeg";
import { isWithin, lockWorkspaceFiles, resolveWorkspacePath } from "@/utils/workspace/files";
import renderer from "../../../../../services/moneyPrinterTurbo/upstream/videoProject.py" with { type: "text" };
import adapter from "../../../../../services/moneyPrinterTurbo/render.py" with { type: "text" };

export const moneyPrinterProvider = "moneyPrinterTurbo";
const footageExtensions = new Set([".mp4", ".mov", ".webm", ".png", ".jpg", ".jpeg", ".webp"]);
const audioExtensions = new Set([".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg"]);
const stillExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const sourceLimit = 100 * 1024 * 1024;
const relativeMedia = z.string().min(1).max(2048).refine(path => !/^[\\/]|[:\x00-\x1f]/.test(path)
  && path.split(/[\\/]/).every(part => part && part !== "." && part !== ".."));
export const moneyPrinterSchema = z.strictObject({
  ratio: z.enum(["9:16", "16:9", "1:1"]),
  resolution: z.enum(["720p", "1080p"]),
  scenes: z.array(z.strictObject({
    path: relativeMedia, duration: z.number().int().min(1).max(60),
    caption: z.string().max(280).refine(line => !/[\r\n\x00-\x09\x0b-\x1f]/.test(line)).optional(),
  })).min(1).max(20),
  narration: relativeMedia.optional(),
  music: relativeMedia.optional(),
  musicVolume: z.number().min(0).max(0.5),
}).refine(input => input.scenes.reduce((total, scene) => total + scene.duration, 0) <= 300, "Mỗi video được dựng tối đa 5 phút.");

type RenderInput = z.infer<typeof moneyPrinterSchema>;

function renderError(message: string, status = 422): never {
  throw Object.assign(new Error(message), { code: "MEDIA_TASK_FAILED", status });
}

async function checkedSource(cwd: string, input: string, extensions: Set<string>) {
  const { path } = await resolveWorkspacePath(cwd, input).catch(() => renderError("Không tìm thấy tư liệu trong dự án. Hãy chọn lại tệp."));
  const extension = extname(path).toLowerCase();
  if (!extensions.has(extension)) renderError("Tệp tư liệu có định dạng chưa được hỗ trợ.");
  const info = await lstat(path).catch(() => renderError("Tư liệu đã bị chuyển hoặc xóa. Hãy chọn lại tệp."));
  if (!info.isFile() || info.isSymbolicLink() || !info.size || info.size > sourceLimit) {
    renderError("Mỗi tệp tư liệu phải có dung lượng từ 1 byte đến 100 MiB.");
  }
  if (stillExtensions.has(extension)) {
    const file = await open(path, "r");
    const header = Buffer.alloc(12);
    try { await file.read(header, 0, 12, 0); } finally { await file.close(); }
    const valid = extension === ".png" ? header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : extension === ".webp" ? header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP"
        : header[0] === 255 && header[1] === 216 && header[2] === 255;
    if (!valid) renderError("Ảnh tư liệu không đúng định dạng. Hãy thử xuất lại ảnh rồi tải lên.");
  }
  return { path, bytes: info.size, image: stillExtensions.has(extension) };
}

function pythonExecutable() {
  const paths = [process.env.PATH, ...(process.platform === "win32" ? [] : ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"])].filter(Boolean).join(delimiter);
  for (const executable of ["python3.14", "python3.13", "python3.12", "python3.11", "python3", "python"]) {
    const path = Bun.which(executable, { PATH: paths });
    if (path) return path;
  }
  return renderError("Máy chạy MacFlow cần Python 3.11 trở lên để dựng video.", 424);
}

export async function renderMoneyPrinter(cwd: string, taskId: string, directory: string, raw: unknown, signal: AbortSignal) {
  const input: RenderInput = moneyPrinterSchema.parse(raw);
  const python = pythonExecutable();
  const { ffmpeg, ffprobe } = await prepareWorkspaceFfmpeg(signal)
    .catch(() => renderError("Chưa có FFmpeg. Mở Chợ plugin → FFmpeg để cài rồi thử lại.", 424));
  const scenes = await Promise.all(input.scenes.map(async scene => ({ ...scene, asset: await checkedSource(cwd, scene.path, footageExtensions) })));
  const [narration, music] = await Promise.all([
    input.narration && checkedSource(cwd, input.narration, audioExtensions),
    input.music && checkedSource(cwd, input.music, audioExtensions),
  ]);
  const assets = [...scenes.map(scene => scene.asset), ...(narration ? [narration] : []), ...(music ? [music] : [])];
  const uniqueAssets = new Map(assets.map(asset => [asset.path, asset.bytes]));
  if ([...uniqueAssets.values()].reduce((sum, bytes) => sum + bytes, 0) > 300 * 1024 * 1024) renderError("Tổng dung lượng tư liệu vượt 300 MiB.");
  await mkdir(directory, { mode: 0o700 }).catch((cause: NodeJS.ErrnoException) => { if (cause.code !== "EEXIST") throw cause; });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) renderError("Thư mục dựng video không hợp lệ.");
  const resolution = input.resolution === "1080p" ? [1080, 1920] : [720, 1280];
  const [short, long] = resolution as [number, number];
  const settings = { width: input.ratio === "16:9" ? long : short,
    height: input.ratio === "9:16" ? long : short, fps: 30, bgm_volume: input.musicVolume };
  const manifest = JSON.stringify({
    settings, scenes: scenes.map(({ asset, duration, caption }) => ({ footage: asset.path, image: asset.image, duration, caption })),
    narration: narration ? narration.path : undefined, bgm: music ? music.path : undefined,
  });
  await Promise.all([
    writeAtomic(join(directory, "videoProject.py"), renderer),
    writeAtomic(join(directory, "render.py"), adapter),
    writeAtomic(join(directory, "manifest.json"), manifest),
  ]);
  const duration = AbortSignal.timeout(18 * 60_000);
  signal.throwIfAborted();
  const process = Bun.spawn([python, "-E", "-s", "-B", join(directory, "render.py"), directory, ffmpeg, ffprobe], {
    cwd: directory, stdin: "ignore", stdout: "pipe", stderr: "ignore",
  });
  const lifetime = AbortSignal.any([signal, duration]);
  const stop = () => { process.kill(); };
  lifetime.addEventListener("abort", stop, { once: true });
  if (lifetime.aborted) stop();
  let output: string;
  let status: number;
  try {
    [output, status] = await Promise.all([new Response(process.stdout).text(), process.exited]);
  } finally { lifetime.removeEventListener("abort", stop); }
  signal.throwIfAborted();
  if (duration.aborted) renderError("Dựng video quá thời gian. Hãy giảm thời lượng hoặc số cảnh rồi thử lại.", 408);
  if (status === 3) renderError("Máy chạy MacFlow cần Python 3.11 trở lên để dựng video.", 424);
  if (status !== 0) renderError("Chưa dựng được video. Hãy kiểm tra ảnh, clip, âm thanh và hỗ trợ phụ đề của FFmpeg rồi thử lại.");
  const parsed = z.object({ export: z.string().min(1) }).safeParse(JSON.parse(output));
  if (!parsed.success) renderError("Bộ dựng chưa tạo tệp MP4 hợp lệ.");
  const rendered = await realpath(parsed.data.export);
  if (!isWithin(await realpath(directory), rendered)) renderError("Đường dẫn kết quả của bộ dựng không hợp lệ.");

  const parent = "assets/generated";
  await mkdir((await resolveWorkspacePath(cwd, parent, true)).path, { recursive: true });
  const path = `${parent}/videoTuLieu${taskId.replaceAll("-", "")}.mp4`;
  const target = (await resolveWorkspacePath(cwd, path)).path;
  const temporary = `${target}.${randomUUID()}.tmp`;
  const unlock = lockWorkspaceFiles([target]);
  try {
    await copyFile(rendered, temporary, constants.COPYFILE_EXCL);
    signal.throwIfAborted();
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(() => {});
    unlock();
  }
  return [{ path, mimeType: "video/mp4", mediaType: "video" as const }];
}
