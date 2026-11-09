import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { areConcatStreamsCompatible, type VideoStreamFingerprint } from "./batchTransitions";

// These fixtures are produced by a real FFmpeg executable. No AI, provider or
// thumbnail is substituted for generated video. Workspace remains untouched.
function tool(binary: "ffmpeg" | "ffprobe", args: string[]) {
  return execFileSync(binary, args, { encoding: "utf8", timeout: 30000, stdio: ["ignore", "pipe", "pipe"] });
}
function fingerprint(path: string) {
  const probe = JSON.parse(tool("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", path])) as {
    streams: { codec_type: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string; pix_fmt?: string; sample_rate?: string }[];
    format: { duration?: string };
  };
  const video = probe.streams.find(stream => stream.codec_type === "video");
  const audio = probe.streams.find(stream => stream.codec_type === "audio");
  if (!video?.codec_name || !video.width || !video.height || !Number.isFinite(Number(probe.format.duration)) || Number(probe.format.duration) <= 0) return;
  return { codec: video.codec_name, width: video.width, height: video.height, hasAudio: !!audio,
    fps: video.avg_frame_rate, pixelFormat: video.pix_fmt,
    audioCodec: audio?.codec_name, audioSampleRate: audio?.sample_rate } satisfies VideoStreamFingerprint;
}
function clip(path: string, color: string, width: number, height: number, codec = "mpeg4") {
  tool("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
    "-i", `color=c=${color}:s=${width}x${height}:r=12`,
    "-t", "0.8", "-an", "-c:v", codec, "-pix_fmt", "yuv420p", path]);
}

describe("HD-05 real FFmpeg fixture regression", () => {
  test("valid video inputs produce a decodable MP4 with positive duration", () => {
    const root = mkdtempSync(join(tmpdir(), "toonflow-batch-ffmpeg-"));
    try {
      const first = join(root, "scene1.mp4"), second = join(root, "scene2.mp4");
      const merged = join(root, "merged.mp4"), manifest = join(root, "concat.txt");
      clip(first, "red", 160, 90);
      clip(second, "blue", 160, 90);
      const probes = [fingerprint(first), fingerprint(second)];
      expect(probes.every(Boolean)).toBe(true);
      expect(areConcatStreamsCompatible(probes as VideoStreamFingerprint[])).toBe(true);
      writeFileSync(manifest, `file '${first}'\nfile '${second}'\n`);
      tool("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
        "-i", manifest, "-c", "copy", "-movflags", "+faststart", "-y", merged]);
      expect(readFileSync(merged).length).toBeGreaterThan(256);
      expect(fingerprint(merged)?.codec).toBe(probes[0]?.codec);
      const detail = JSON.parse(tool("ffprobe", ["-v", "error", "-show_format", "-of", "json", merged])) as { format: { duration?: string } };
      expect(Number(detail.format.duration)).toBeGreaterThan(1);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60000);
  test("incompatible geometry, codec, fps, audio are rejected before merging", () => {
    const base: VideoStreamFingerprint = { codec: "mpeg4", width: 160, height: 90, hasAudio: false, fps: "12/1", pixelFormat: "yuv420p" };
    for (const altered of [
      { codec: "h264" }, { width: 128 }, { height: 72 }, { hasAudio: true },
      { fps: "24/1" }, { pixelFormat: "yuv422p" }, { audioCodec: "aac" },
    ]) expect(areConcatStreamsCompatible([base, { ...base, ...altered }])).toBe(false);
    expect(areConcatStreamsCompatible([])).toBe(false);
    expect(areConcatStreamsCompatible([base])).toBe(false);
  });
  test("a valid PNG thumbnail is not accepted as a video stream", () => {
    const root = mkdtempSync(join(tmpdir(), "toonflow-batch-poster-"));
    try {
      const poster = join(root, "poster.png");
      tool("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi",
        "-i", "color=c=black:s=32x32", "-frames:v", "1", "-y", poster]);
      const value = fingerprint(poster);
      expect(value).toBeUndefined();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
