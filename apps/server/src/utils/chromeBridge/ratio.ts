// Chrome Companion currently has no verified native image/video aspect ratio selector.
// Treat these as user intentions and enforce their transmission as prompt-only guidance.
export const requestedRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
export function prepareChromePrompt(kind: "text" | "image" | "video", prompt: string, options: object): string {
  if (kind === "text") return prompt;
  const request = options as { ratio?: unknown; size?: unknown; duration?: unknown };
  if (request.ratio !== undefined && (typeof request.ratio !== "string" ||
    !requestedRatios.some(value => value === request.ratio)))
    throw new Error("Tỷ lệ không hợp lệ hoặc chưa được adapter Chrome kiểm chứng");
  const guidance = [
    ...(request.ratio ? [`Requested output aspect ratio: ${request.ratio}. This is prompt-only guidance; the AI website may ignore it.`] : []),
    ...(kind === "image" && typeof request.size === "string" && request.size.length <= 30
      ? [`Requested image resolution: ${request.size} (guidance only, not a guaranteed output size).`] : []),
    ...(kind === "video" && typeof request.duration === "number" && request.duration > 0 && request.duration <= 300
      ? [`Requested video duration: approximately ${request.duration} seconds, if supported by the AI account.`] : []),
  ];
  return guidance.length ? [prompt, ...guidance].join("\n\n") : prompt;
}
