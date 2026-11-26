import type { BrowserFfmpegFactory, FfprobeData } from "@toonflow/nodes-scaffold/runtime";

const frameRate = 30;

function probe(ffmpeg: BrowserFfmpegFactory, path: string) {
  return new Promise<FfprobeData>((resolve, reject) => {
    ffmpeg(path).ffprobe((error, data) => error ? reject(error) : resolve(data));
  });
}

function ratio(value?: string) {
  const [width, height] = value?.split(":").map(Number) ?? [];
  return width && height && width > 0 && height > 0 ? width / height : 1;
}

export async function mergeVideo(ffmpeg: BrowserFfmpegFactory, paths: string[], output: string, signal: AbortSignal) {
  if (paths.length < 2) throw new Error("Cần ít nhất hai clip để ghép video.");
  const clips = [];
  for (const [index, path] of paths.entries()) {
    signal.throwIfAborted();
    try {
      const { streams, format } = await probe(ffmpeg, path);
      const video = streams.find(stream => stream.codec_type === "video" && !stream.disposition?.attached_pic);
      const audio = streams.find(stream => stream.codec_type === "audio");
      const duration = [video?.duration, format.duration].map(Number).find(value => Number.isFinite(value) && value > 0);
      if (!video?.width || !video.height || duration === undefined) throw new Error("Không tìm thấy hình ảnh hoặc thời lượng video hợp lệ.");
      const start = Number(audio?.start_time ?? 0) - Number(video.start_time ?? 0);
      clips.push({ video, audio, duration: Math.max(1, Math.round(duration * frameRate)) / frameRate,
        audioDelay: Number.isFinite(start) ? start : 0 });
    } catch (error) {
      signal.throwIfAborted();
      throw new Error(`Không đọc được clip ${index + 1}. ${error instanceof Error ? error.message : ""}`, { cause: error });
    }
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

  const hasAudio = clips.some(clip => !!clip.audio);
  const filters = clips.flatMap(({ video, audio, duration, audioDelay }, index) => {
    const picture = [
      `[${index}:${video.index}]setpts=PTS-STARTPTS`,
      `scale=w='max(2,trunc(min(${width},${height}*dar)/2)*2)':h='max(2,trunc(min(${height},${width}/dar)/2)*2)'`,
      `setsar=1,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      `fps=${frameRate},format=yuv420p,tpad=stop_mode=clone:stop_duration=1,trim=duration=${duration},setpts=PTS-STARTPTS[v${index}]`,
    ].join(",");
    if (!hasAudio) return [picture];
    const alignment = audioDelay > 0 ? `,adelay=${Math.round(audioDelay * 1000)}:all=1`
      : audioDelay < 0 ? `,atrim=start=${-audioDelay},asetpts=PTS-STARTPTS` : "";
    const sound = audio
      ? `[${index}:${audio.index}]aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS${alignment},apad=whole_dur=${duration}`
      : "anullsrc=r=48000:cl=stereo";
    return [picture, `${sound},atrim=duration=${duration},asetpts=PTS-STARTPTS[a${index}]`];
  });
  const timeline = clips.map((_clip, index) => `[v${index}]${hasAudio ? `[a${index}]` : ""}`).join("");
  filters.push(`${timeline}concat=n=${clips.length}:v=1:a=${Number(hasAudio)}[video]${hasAudio ? "[audio]" : ""}`);

  signal.throwIfAborted();
  const command = ffmpeg();
  for (const path of paths) command.input(path);
  command.complexFilter(filters).output(output).format("mp4").videoCodec("libx264")
    .outputOptions("-filter_complex_threads", "1", "-map", "[video]", "-preset", "fast", "-crf", "18", "-movflags", "+faststart");
  if (hasAudio) command.audioCodec("aac").audioBitrate(192).outputOptions("-map", "[audio]");
  await new Promise<void>((resolve, reject) => { command.on("error", reject).on("end", () => resolve()).run(); });
  signal.throwIfAborted();

  const result = await probe(ffmpeg, output);
  const duration = Number(result.format.duration);
  if (!Number.isFinite(duration) || duration <= 0 || !result.streams.some(stream => stream.codec_type === "video")) {
    throw new Error("Không đọc được tệp video sau khi ghép.");
  }
}
