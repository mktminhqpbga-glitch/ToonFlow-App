export type SubtitleCue = { id: string; start: number; end: number; text: string };
export type SubtitleSettings = { cues: SubtitleCue[]; burn: boolean; size: number; position: "top" | "bottom" };

function parseTime(value: string) {
  const match = /^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(value);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000 : NaN;
}

export function parseSrt(content: string): SubtitleCue[] {
  const blocks = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim().split(/\n[ \t]*\n+/);
  return validateCues(blocks.map((block, index) => {
    const lines = block.split("\n");
    if (/^\d+$/.test(lines[0]?.trim() ?? "")) lines.shift();
    const match = /^(\S+)\s+-->\s+(\S+)(?:\s.*)?$/.exec(lines.shift()?.trim() ?? "");
    if (!match) throw new Error(`Không đọc được mốc thời gian của phụ đề ${index + 1}.`);
    return { id: crypto.randomUUID(), start: parseTime(match[1]!), end: parseTime(match[2]!), text: lines.join("\n").trim() };
  }));
}

export function validateCues(cues: readonly SubtitleCue[]) {
  return cues.map((cue, index) => {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start || !cue.text.trim()) {
      throw new Error(`Phụ đề ${index + 1} cần nội dung và mốc bắt đầu nhỏ hơn mốc kết thúc.`);
    }
    return { ...cue, text: cue.text.replace(/\r\n?/g, "\n").trim() };
  }).sort((left, right) => left.start - right.start);
}

function stamp(seconds: number, decimals: 2 | 3) {
  const unit = 10 ** decimals;
  const ticks = Math.round(seconds * unit);
  const hours = Math.floor(ticks / (unit * 3600));
  const minutes = Math.floor(ticks / (unit * 60)) % 60;
  const whole = Math.floor(ticks / unit) % 60;
  const fraction = String(ticks % unit).padStart(decimals, "0");
  return `${String(hours).padStart(decimals === 3 ? 2 : 1, "0")}:${String(minutes).padStart(2, "0")}:${String(whole).padStart(2, "0")}${decimals === 3 ? "," : "."}${fraction}`;
}

export function createSrt(cues: readonly SubtitleCue[]) {
  return validateCues(cues).map((cue, index) =>
    `${index + 1}\n${stamp(cue.start, 3)} --> ${stamp(cue.end, 3)}\n${cue.text.replace(/\n[ \t]*\n+/g, "\n")}\n`,
  ).join("\n");
}

export function createAss(settings: SubtitleSettings, width: number, height: number, duration: number) {
  const fontSize = Math.round(Math.min(width, height) * settings.size / 100);
  const margin = Math.max(8, Math.round(height * 0.06));
  const alignment = settings.position === "top" ? 8 : 2;
  const lines = validateCues(settings.cues).flatMap(cue => {
    if (cue.start >= duration) return [];
    const end = Math.min(cue.end, duration);
    if (stamp(cue.start, 2) === stamp(end, 2)) return [];
    // Dialogue text cannot inject ASS formatting or create a second event.
    const text = cue.text.replace(/[{}\\]/g, character => ({ "{": "｛", "}": "｝", "\\": "＼" })[character]!)
      .replace(/[\u0000-\u0009\u000b-\u001f]/g, "").replaceAll("\n", "\\N");
    return [`Dialogue: 0,${stamp(cue.start, 2)},${stamp(end, 2)},Default,,0,0,0,,${text}`];
  });
  if (!lines.length) throw new Error("Các mốc phụ đề nằm ngoài thời lượng video sau khi cắt và chuyển cảnh.");
  return [
    "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${width}`, `PlayResY: ${height}`, "ScaledBorderAndShadow: yes", "",
    "[V4+ Styles]", "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,Arial,${Math.max(10, fontSize)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${Math.max(1, Math.round(fontSize / 12))},0,${alignment},${Math.max(8, Math.round(width * 0.06))},${Math.max(8, Math.round(width * 0.06))},${margin},1`,
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text", ...lines, "",
  ].join("\n");
}
