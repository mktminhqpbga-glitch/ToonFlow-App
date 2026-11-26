import type { BrowserFfmpegCommand, BrowserFfmpegFactory, FfprobeData, NodeMediaValue } from "@toonflow/nodes-scaffold/runtime";

export type LocalAudio = NodeMediaValue & { name: string };
export type AudioSettings = {
  musicFile?: LocalAudio; voiceFile?: LocalAudio;
  originalVolume: number; musicVolume: number; voiceVolume: number; voiceOffset: number;
  loop: boolean; fade: boolean; duck: boolean;
};
export type AudioTracks = { music?: NodeMediaValue; voice?: NodeMediaValue };

export function probe(ffmpeg: BrowserFfmpegFactory, path: string) {
  return new Promise<FfprobeData>((resolve, reject) => {
    ffmpeg(path).ffprobe((error, data) => error ? reject(error) : resolve(data));
  });
}

export function readDuration(...values: unknown[]) {
  return values.map(Number).find(value => Number.isFinite(value) && value > 0);
}

export function seconds(value: number) { return value.toFixed(6); }

export async function mixAudio(command: BrowserFfmpegCommand, ffmpeg: BrowserFfmpegFactory, filters: string[], options: {
  original: boolean; tracks: AudioTracks; settings: AudioSettings; inputCount: number; duration: number; signal: AbortSignal;
}) {
  const { settings, tracks, duration, signal, original } = options;
  if ([settings.originalVolume, settings.musicVolume, settings.voiceVolume].some(value => !Number.isFinite(value) || value < 0 || value > 200)) {
    throw new Error("Âm lượng phải từ 0% đến 200%.");
  }
  if (tracks.voice && settings.voiceVolume > 0 && (!Number.isFinite(settings.voiceOffset) || settings.voiceOffset < 0 || settings.voiceOffset >= duration)) {
    throw new Error("Mốc bắt đầu lời đọc phải nằm trong thời lượng video sau khi cắt và chuyển cảnh.");
  }
  const duck = settings.duck && Boolean(tracks.music && settings.musicVolume && tracks.voice && settings.voiceVolume);
  let nextInput = options.inputCount;
  const foreground: string[] = [];
  if (original) {
    filters.push(`[original]volume=${settings.originalVolume / 100}[clipAudio]`);
    foreground.push("[clipAudio]");
  }
  for (const kind of ["voice", "music"] as const) {
    const file = tracks[kind];
    const volume = kind === "voice" ? settings.voiceVolume : settings.musicVolume;
    if (!file || !volume) continue;
    signal.throwIfAborted();
    const media = await probe(ffmpeg, file.url).catch(error => {
      signal.throwIfAborted();
      throw new Error(kind === "voice" ? "Không đọc được tệp lời đọc." : "Không đọc được tệp nhạc nền.", { cause: error });
    });
    const audio = media.streams.find(stream => stream.codec_type === "audio");
    if (!audio) throw new Error(kind === "voice" ? "Tệp lời đọc không có âm thanh." : "Tệp nhạc nền không có âm thanh.");
    command.input(file.url);
    const isMusic = kind === "music";
    if (isMusic && settings.loop) command.inputOptions("-stream_loop", "-1");
    const chain = [`[${nextInput++}:${audio.index}]aformat=sample_rates=48000:channel_layouts=stereo`, "asetpts=PTS-STARTPTS"];
    if (isMusic && settings.fade) {
      const musicLength = settings.loop ? duration : Math.min(duration, readDuration(audio.duration, media.format.duration) ?? duration);
      const fade = Math.min(1, musicLength / 2);
      chain.push(`afade=t=in:d=${seconds(fade)}`, `afade=t=out:st=${seconds(musicLength - fade)}:d=${seconds(fade)}`);
    }
    if (!isMusic && settings.voiceOffset) chain.push(`adelay=${Math.round(settings.voiceOffset * 1000)}:all=1`);
    chain.push(`volume=${volume / 100}`, `apad=whole_dur=${seconds(duration)}`, `atrim=duration=${seconds(duration)}[${kind}]`);
    filters.push(chain.join(","));
    if (!isMusic) {
      if (duck) filters.push("[voice]asplit=2[keepVoice][sidechain]");
      foreground.push(duck ? "[keepVoice]" : "[voice]");
    }
  }
  if (foreground.length > 1) filters.push(`${foreground.join("")}amix=inputs=${foreground.length}:normalize=0[foreground]`);
  let base = foreground.length > 1 ? "[foreground]" : foreground[0];
  if (duck) filters.push("[music][sidechain]sidechaincompress=threshold=0.025:ratio=5:attack=20:release=300[ducked]");
  const music = duck ? "[ducked]" : tracks.music && settings.musicVolume ? "[music]" : "";
  if (!base && !music) return false;
  if (base && music) {
    filters.push(`${base}${music}amix=inputs=2:normalize=0[mixed]`);
    base = "[mixed]";
  }
  filters.push(`${base || music}alimiter=limit=0.95:level=0:latency=1,atrim=duration=${seconds(duration)}[audio]`);
  return true;
}
