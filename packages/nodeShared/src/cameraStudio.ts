// Camera Studio provides prompt-only artistic guidance, not optical hardware control.
export const cameraBodies = ["", "Sony Venice", "ARRI Alexa 35", "RED V-Raptor", "Blackmagic URSA", "Cinema camera"];
export const cameraLenses = ["", "Zeiss Ultra Prime", "Cooke S4/i", "Anamorphic", "Spherical", "Vintage"];
export const focalPresets = [18, 24, 28, 35, 50, 85, 100, 135];
export const aperturePresets = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
export type CameraSettings = { enabled: boolean; body: string; lens: string; focalLength: number; aperture: number };
export const defaultCameraSettings = (): CameraSettings => ({ enabled: false, body: "", lens: "", focalLength: 35, aperture: 2.8 });
export function normalizeCameraSettings(value?: Partial<CameraSettings>): CameraSettings {
  const defaults = defaultCameraSettings();
  return {
    enabled: value?.enabled === true,
    body: typeof value?.body === "string" && cameraBodies.includes(value.body) ? value.body : defaults.body,
    lens: typeof value?.lens === "string" && cameraLenses.includes(value.lens) ? value.lens : defaults.lens,
    focalLength: typeof value?.focalLength === "number" && Number.isFinite(value.focalLength)
      && value.focalLength >= 12 && value.focalLength <= 200 ? value.focalLength : defaults.focalLength,
    aperture: typeof value?.aperture === "number" && aperturePresets.includes(value.aperture)
      ? value.aperture : defaults.aperture,
  };
}
export function buildCameraInstructions(value?: CameraSettings, language = "en"): string {
  const camera = normalizeCameraSettings(value);
  if (!camera.enabled) return "";
  if (language === "vi") return [
    "Hướng dẫn quay phim ảo (AI chỉ diễn giải phong cách hình ảnh; chưa xác minh khả năng điều khiển máy ảnh vật lý):",
    ...(camera.body ? [`Tham chiếu phong cách thân máy: ${camera.body}.`] : []),
    ...(camera.lens ? [`Đặc trưng tái hiện hình ảnh của ống kính: ${camera.lens}.`] : []),
    `Phối cảnh tiêu cự mong muốn: ${camera.focalLength} mm.`,
    `Diện mạo độ sâu trường ảnh mong muốn: f/${camera.aperture}.`,
    "Giữ nguyên chủ thể người dùng yêu cầu. Các chỉ dẫn này mô tả phong cách, không phải thông số quang học chính xác.",
  ].join("\n");
  return [
    "Virtual cinematography guidance (AI visual interpretation only; no verified physical camera controls):",
    ...(camera.body ? [`Camera body visual reference: ${camera.body}.`] : []),
    ...(camera.lens ? [`Lens rendering character: ${camera.lens}.`] : []),
    `Requested focal-length perspective: ${camera.focalLength} mm.`,
    `Requested depth-of-field look: f/${camera.aperture}.`,
    "Preserve the original user subject. These instructions are stylistic, not exact optical specifications.",
  ].join("\n");
}
export function appendCameraInstructions(prompt: string, value?: CameraSettings, language = "en"): string {
  const instructions = buildCameraInstructions(value, language);
  return instructions ? [prompt, instructions].filter(Boolean).join("\n\n") : prompt;
}
