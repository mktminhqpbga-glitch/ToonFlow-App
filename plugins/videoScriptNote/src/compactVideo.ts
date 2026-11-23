import type { BrowserFfmpegCommand, BrowserFfmpegFactory, FfprobeData } from "@toonflow/nodes-scaffold/runtime";

const mib = 1024 * 1024;
// MacFlow's default JSON budget is 32 MiB. Base64 adds about a third plus JSON overhead.
export const originalVideoBudget = 22 * mib;
export const compactVideoBudget = 8 * mib;

function probeDuration(command: BrowserFfmpegCommand, signal: AbortSignal) {
  signal.throwIfAborted();
  const abort = () => command.kill();
  signal.addEventListener("abort", abort, { once: true });
  return new Promise<FfprobeData>((resolve, reject) => {
    command.ffprobe((error, data) => {
      if (signal.aborted) reject(signal.reason);
      else if (error) reject(error);
      else resolve(data);
    });
  }).finally(() => signal.removeEventListener("abort", abort));
}

export async function encodeCompactVideo(ffmpeg: BrowserFfmpegFactory, source: string, output: string, byteBudget: number, signal: AbortSignal) {
  const info = await probeDuration(ffmpeg(source), signal);
  const track = info.streams.find(stream => stream.codec_type === "video" && !stream.disposition?.attached_pic);
  const duration = Number(info.format.duration ?? track?.duration);
  if (!track || !Number.isFinite(duration) || duration <= 0) throw new Error("Không đọc được thời lượng video để nén.");
  const audioKbps = info.streams.some(stream => stream.codec_type === "audio") ? 80 : 0;
  const videoKbps = Math.min(1600, Math.floor(byteBudget * 0.92 * 8 / duration / 1000) - audioKbps);
  if (videoKbps < 100) throw new Error("Không thể nén thêm video trong giới hạn gửi. Hãy dùng Khung hình.");
  signal.throwIfAborted();
  const command = ffmpeg(source).output(output).format("mp4").videoCodec("libx264").videoBitrate(videoKbps)
    .videoFilters("scale='min(720,iw)':'min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2")
    .outputOptions("-map", `0:${track.index}`, "-map", "0:a:0?", "-preset", "fast", "-pix_fmt", "yuv420p",
      "-maxrate", `${videoKbps}k`, "-bufsize", `${videoKbps * 2}k`, "-movflags", "+faststart");
  if (audioKbps) command.audioCodec("aac").audioBitrate(audioKbps);

  const abort = () => command.kill();
  signal.addEventListener("abort", abort, { once: true });
  try {
    await new Promise<void>((resolve, reject) => {
      command.on("start", () => { if (signal.aborted) command.kill(); });
      command.on("end", () => signal.aborted ? reject(signal.reason) : resolve());
      command.on("error", error => reject(signal.aborted ? signal.reason : error));
      command.run();
    });
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
