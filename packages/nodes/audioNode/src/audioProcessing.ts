import type { BrowserFfmpegCommand, BrowserFfmpegFactory, FfprobeData } from "@toonflow/ffmpeg/browser";
import { getPcmOptions, type PcmOptions } from "@toonflow/node-shared/pcmPreview";

export type AudioSegment = { start: number; end: number };
export type AudioProcessingOptions = { outputPath: string; pcm?: PcmOptions } & (
  { action: "speed"; speed: number } | { action: "clip"; segments: AudioSegment[] }
);

function normalizePath(path: string) {
  if (!path || /[\x00-\x1f]/.test(path) || /^(?:[\\/]|[a-z][a-z\d+.-]*:)/i.test(path) || path.split(/[\\/]+/).includes("..")) {
    throw new Error("Xử lý âm thanh phải dùng đường dẫn tương đối trong không gian làm việc");
  }
  const normalized = path.split(/[\\/]+/).filter(part => part && part !== ".").join("/").toLowerCase();
  if (!normalized) throw new Error("Đường dẫn xử lý âm thanh không được rỗng");
  return normalized;
}

function probeAudio(ffmpeg: BrowserFfmpegFactory, path: string, signal?: AbortSignal, inputOptions: string[] = []) {
  signal?.throwIfAborted();
  const command = ffmpeg(path);
  const cancel = () => command.kill();
  signal?.addEventListener("abort", cancel, { once: true });
  return new Promise<FfprobeData>((resolve, reject) => {
    command.ffprobe({ options: inputOptions }, (error, data) => {
      if (signal?.aborted) reject(signal.reason);
      else if (error) reject(error);
      else resolve(data);
    });
  }).finally(() => signal?.removeEventListener("abort", cancel));
}

function runCommand(command: BrowserFfmpegCommand, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const cancel = () => command.kill();
  signal?.addEventListener("abort", cancel, { once: true });
  return new Promise<void>((resolve, reject) => {
    command.on("start", () => { if (signal?.aborted) command.kill(); });
    command.on("error", error => reject(signal?.aborted ? signal.reason : error));
    command.on("end", () => signal?.aborted ? reject(signal.reason) : resolve());
    command.run();
  }).finally(() => signal?.removeEventListener("abort", cancel));
}

/** 调用方负责输出目录、唯一文件名和失败清理，处理结果不会覆盖原音频。 */
export async function processAudio(ffmpeg: BrowserFfmpegFactory, source: string, options: AudioProcessingOptions, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (normalizePath(source) === normalizePath(options.outputPath)) throw new Error("Tệp đầu ra không được ghi đè âm thanh gốc");
  if (!["speed", "clip"].includes(options.action)) throw new Error("Thao tác xử lý âm thanh không xác định");
  if (options.action === "speed" && (!Number.isFinite(options.speed) || options.speed < 0.1 || options.speed > 4)) {
    throw new Error("Tốc độ âm thanh phải từ 0,1 đến 4 lần");
  }
  if (options.pcm && !getPcmOptions(options.pcm)) throw new Error("Tần số lấy mẫu PCM, số kênh hoặc định dạng mẫu không hợp lệ");
  const inputOptions = options.pcm ? ["-f", options.pcm.format, "-sample_rate", String(options.pcm.sampleRate), "-channels", String(options.pcm.channels)] : [];
  const media = await probeAudio(ffmpeg, source, signal, inputOptions);
  const audio = media.streams.find(stream => stream.codec_type === "audio");
  if (!audio) throw new Error("Tệp không có luồng âm thanh");
  const duration = Math.max(...[audio.duration, media.format.duration].map(Number).filter(value => Number.isFinite(value) && value > 0));
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Không đọc được thời lượng âm thanh hợp lệ");
  if (options.action === "clip" && (!Array.isArray(options.segments) || options.segments.length === 0
    || options.segments.some(segment => !segment || !Number.isFinite(segment.start) || !Number.isFinite(segment.end)
      || segment.start < 0 || segment.end <= segment.start || segment.end > duration))) {
    throw new Error("Mỗi đoạn phải thỏa mãn 0 ≤ thời điểm bắt đầu < thời điểm kết thúc ≤ thời lượng âm thanh");
  }

  const command = ffmpeg(source).output(options.outputPath).noVideo().audioCodec("aac").audioBitrate(192).format("ipod")
    .outputOptions("-movflags", "+faststart");
  if (inputOptions.length) command.inputOptions(inputOptions);
  if (options.action === "speed") {
    let tempo = options.speed;
    const filters: string[] = [];
    // ACT: 每级保持在 0.5–2 倍，避免高倍 atempo 跳过采样，并覆盖最低 0.1 倍速度。
    while (tempo < 0.5) { filters.push("atempo=0.5"); tempo /= 0.5; }
    while (tempo > 2) { filters.push("atempo=2"); tempo /= 2; }
    command.audioFilters([...filters, `atempo=${tempo}`]).outputOptions("-map", "0:a:0");
  } else {
    const filters = options.segments.map((segment, index) =>
      `[0:a:0]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS[part${index}]`);
    filters.push(`${options.segments.map((_segment, index) => `[part${index}]`).join("")}concat=n=${options.segments.length}:v=0:a=1[result]`);
    command.complexFilter(filters).outputOptions("-map", "[result]");
  }
  await runCommand(command, signal);
  const result = await probeAudio(ffmpeg, options.outputPath, signal);
  const resultDuration = Number(result.format.duration);
  if (!Number.isFinite(resultDuration) || resultDuration <= 0 || !result.streams.some(stream => stream.codec_type === "audio")) {
    throw new Error("Tệp âm thanh được tạo không hợp lệ");
  }
  return { duration: resultDuration };
}
