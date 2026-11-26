import type { BrowserFfmpegFactory, FfprobeData } from "@toonflow/nodes-scaffold/runtime";
import { mixAudio, probe, readDuration, seconds, type AudioSettings, type AudioTracks } from "./audioMix";
import { createAss, type SubtitleSettings } from "./subtitles";

const frameRate = 30;
type ClipRange = { start: number | null; end: number | null };
export type { ClipRange };
export type Transition = { type: "cut" | "fade"; duration: number };
type RenderOptions = {
  audio: AudioSettings;
  tracks: AudioTracks;
  transition: Transition;
  subtitles: SubtitleSettings;
  writeCaptions: (content: string) => Promise<string>;
  signal: AbortSignal;
};

function ratio(value?: string) {
  const [width, height] = value?.split(":").map(Number) ?? [];
  return width && height && width > 0 && height > 0 ? width / height : 1;
}

export async function mergeVideo(ffmpeg: BrowserFfmpegFactory, sources: (ClipRange & { path: string })[], output: string, options: RenderOptions) {
  const { audio: audioSettings, tracks, transition, subtitles, writeCaptions, signal } = options;
  if (sources.length < 2) throw new Error("Cần ít nhất hai clip để ghép video.");
  const clips = [];
  for (const [index, source] of sources.entries()) {
    signal.throwIfAborted();
    const { streams, format } = await probe(ffmpeg, source.path).catch(error => {
      signal.throwIfAborted();
      throw new Error(`Không đọc được clip ${index + 1}. ${error instanceof Error ? error.message : ""}`, { cause: error });
    });
    const video = streams.find(stream => stream.codec_type === "video" && !stream.disposition?.attached_pic);
    const audio = streams.find(stream => stream.codec_type === "audio");
    const duration = readDuration(video?.duration, format.duration);
    if (!video?.width || !video.height || duration === undefined) throw new Error(`Clip ${index + 1} thiếu hình ảnh hoặc thời lượng hợp lệ.`);
    const start = source.start ?? 0;
    const end = source.end ?? duration;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || start >= duration || end - duration >= 0.01) {
      throw new Error(`Mốc cắt của clip ${index + 1} phải nằm trong ${Number(duration.toFixed(3))} giây và mốc đầu phải nhỏ hơn mốc cuối.`);
    }
    const audioDelay = Number(audio?.start_time ?? 0) - Number(video.start_time ?? 0);
    clips.push({ video, audio, start, frames: Math.max(1, Math.round((Math.min(end, duration) - start) * frameRate)),
      audioDelay: Number.isFinite(audioDelay) ? audioDelay : 0 });
  }
  const first = clips[0]!.video as FfprobeData["streams"][number] & { side_data_list?: { rotation?: number }[] };
  const rotation = Number(first.side_data_list?.find(item => item.rotation !== undefined)?.rotation ?? first.tags?.rotate ?? 0);
  const displayWidth = first.width! * ratio(first.sample_aspect_ratio);
  const rotated = Math.abs(rotation % 180) === 90;
  const width = Math.max(2, Math.round((rotated ? first.height! : displayWidth) / 2) * 2);
  const height = Math.max(2, Math.round((rotated ? displayWidth : first.height!) / 2) * 2);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || Math.max(width, height) > 8192) {
    throw new Error("Kích thước khung hình của clip đầu vượt giới hạn xuất video.");
  }

  const fade = transition.type === "fade";
  if (fade && (!Number.isFinite(transition.duration) || transition.duration < 0.1 || transition.duration > 5)) {
    throw new Error("Thời lượng chuyển cảnh phải từ 0,1 đến 5 giây.");
  }
  const fadeFrames = fade ? Math.round(transition.duration * frameRate) : 0;
  const shortClip = clips.findIndex(({ frames }, index) => frames <= fadeFrames * (index === 0 || index === clips.length - 1 ? 1 : 2));
  if (shortClip >= 0) throw new Error(`Clip ${shortClip + 1} quá ngắn cho chuyển cảnh đã chọn. Hãy giảm thời lượng chuyển cảnh hoặc lấy thêm đoạn trong clip.`);
  const hasOriginal = audioSettings.originalVolume > 0 && clips.some(clip => clip.audio);
  const filters = clips.flatMap(({ video, audio, start, frames, audioDelay }, index) => {
    const duration = frames / frameRate;
    const picture = [
      `[${index}:${video.index}]setpts=PTS-STARTPTS`,
      `scale=w='max(2,trunc(min(${width},${height}*dar)/2)*2)':h='max(2,trunc(min(${height},${width}/dar)/2)*2)'`,
      `setsar=1,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      `fps=${frameRate},format=${fade ? "yuv444p" : "yuv420p"}`,
      `tpad=stop_mode=clone:stop_duration=1,trim=start_frame=${Math.round(start * frameRate)}:end_frame=${Math.round(start * frameRate) + frames}`,
      `setpts=PTS-STARTPTS,fps=${frameRate}[v${index}]`,
    ].join(",");
    if (!hasOriginal) return [picture];
    const alignment = audioDelay > 0 ? `,adelay=${Math.round(audioDelay * 1000)}:all=1`
      : audioDelay < 0 ? `,atrim=start=${seconds(-audioDelay)},asetpts=PTS-STARTPTS` : "";
    const sound = audio
      ? `[${index}:${audio.index}]aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS${alignment},apad`
      : "anullsrc=r=48000:cl=stereo";
    return [picture, `${sound},atrim=start=${seconds(start)}:end=${seconds(start + duration)},asetpts=PTS-STARTPTS[a${index}]`];
  });
  let frames = clips[0]!.frames;
  let picture = "v0";
  let original = "a0";
  if (fade) {
    for (let index = 1; index < clips.length; index++) {
      const previous = picture;
      const previousAudio = original;
      picture = `fadeVideo${index}`;
      original = `fadeAudio${index}`;
      filters.push(`[${previous}][v${index}]xfade=transition=fade:duration=${seconds(fadeFrames / frameRate)}:offset=${seconds((frames - fadeFrames) / frameRate)},fps=${frameRate}[${picture}]`);
      if (hasOriginal) filters.push(`[${previousAudio}][a${index}]acrossfade=ns=${fadeFrames * (48000 / frameRate)}:c1=tri:c2=tri[${original}]`);
      frames += clips[index]!.frames - fadeFrames;
    }
    if (hasOriginal) filters.push(`[${original}]anull[original]`);
  } else {
    const timeline = clips.map((_clip, index) => `[v${index}]${hasOriginal ? `[a${index}]` : ""}`).join("");
    picture = "concatenated";
    frames = clips.reduce((total, clip) => total + clip.frames, 0);
    filters.push(`${timeline}concat=n=${clips.length}:v=1:a=${Number(hasOriginal)}[${picture}]${hasOriginal ? "[original]" : ""}`);
  }
  const duration = frames / frameRate;
  const videoFilters = [`[${picture}]trim=end_frame=${frames}`];
  if (subtitles.burn && subtitles.cues.length) {
    const path = await writeCaptions(createAss(subtitles, width, height, duration));
    videoFilters.push(`ass=filename=${path}`);
  }
  videoFilters.push("format=yuv420p[video]");
  filters.push(videoFilters.join(","));

  signal.throwIfAborted();
  const command = ffmpeg();
  for (const source of sources) command.input(source.path);
  const hasAudio = await mixAudio(command, ffmpeg, filters, { original: hasOriginal, tracks, settings: audioSettings, inputCount: sources.length, duration, signal });
  signal.throwIfAborted();
  command.complexFilter(filters).output(output).format("mp4").videoCodec("libx264")
    .outputOptions("-filter_complex_threads", "1", "-map", "[video]", "-preset", "fast", "-crf", "18", "-movflags", "+faststart");
  if (hasAudio) command.audioCodec("aac").audioBitrate(192).outputOptions("-map", "[audio]");
  let captionFilterMissing = false;
  let filterError = "";
  command.on("stderr", line => {
    if (/No such filter.*['"]ass['"]/.test(line)) captionFilterMissing = true;
    if (!filterError && /\[Parsed_\w+_\d+ @ [^\]]+\]/.test(line) && /fail|invalid|could not|unable/i.test(line)) {
      filterError = line.replace(/^\[[^\]]+\]\s*/, "");
    }
  });
  await new Promise<void>((resolve, reject) => { command.on("error", reject).on("end", () => resolve()).run(); }).catch(error => {
    if (captionFilterMissing) {
      throw new Error("Cần bản FFmpeg có hỗ trợ libass để ghi phụ đề vào video.", { cause: error });
    }
    const detail = filterError || (error instanceof Error ? error.message.trim() : "");
    throw new Error(`Không xuất được MP4.${detail ? " " + detail : ""}`, { cause: error });
  });
  signal.throwIfAborted();
  const result = await probe(ffmpeg, output);
  if (!readDuration(result.format.duration) || !result.streams.some(stream => stream.codec_type === "video")) {
    throw new Error("Không đọc được tệp video sau khi ghép.");
  }
}
