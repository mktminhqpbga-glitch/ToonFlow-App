import { z } from "@toonflow/nodes-scaffold/runtime";

export const lightingPresets = [
  { id: "film", label: "Phim sáng dịu", prompt: "airy high-key exposure with gently faded highlights, broad soft illumination and a subtle analogue-film finish", settings: { azimuth: 0, elevation: 25, brightness: 85, lightColor: "#fff3dd", rimLight: false } },
  { id: "blue", label: "Viền sáng xanh", prompt: "a cool blue backlight separating the silhouette from the scene, restrained frontal fill and a luminous atmospheric edge", settings: { azimuth: 0, elevation: 20, brightness: 25, lightColor: "#ffffff", rimLight: true, rimAzimuth: -180, rimElevation: 20, rimBrightness: 70, rimColor: "#72a7ff" } },
  { id: "portrait", label: "Chân dung cổ điển", prompt: "a sculpted portrait key light from the upper side, a small triangular highlight on the shadowed cheek and rich painterly tonal depth", settings: { azimuth: -45, elevation: 35, brightness: 50, lightColor: "#ffffff", rimLight: false } },
  { id: "neon", label: "Neon ban đêm", prompt: "contrasting cyan and pink light spilling across existing surfaces, vivid nocturnal color separation and a futuristic urban mood", settings: { azimuth: 90, elevation: 10, brightness: 55, lightColor: "#52e5ec", rimLight: true, rimAzimuth: -135, rimElevation: 15, rimBrightness: 65, rimColor: "#ff67ca" } },
  { id: "sunset", label: "Hoàng hôn ấm", prompt: "low amber sunset illumination, elongated soft shadows and warm nostalgic color with a dreamy dusk atmosphere", settings: { azimuth: -120, elevation: 10, brightness: 65, lightColor: "#ffad69", rimLight: true, rimAzimuth: 150, rimElevation: 10, rimBrightness: 50, rimColor: "#ffc078" } },
  { id: "noir", label: "Điện ảnh bí ẩn", prompt: "restrained low-key illumination, dense shadow areas and selective highlights for a tense monochromatic cinematic mood", settings: { azimuth: -90, elevation: 30, brightness: 15, lightColor: "#ffffff", rimLight: false } },
  { id: "golden", label: "Ánh vàng dịu", prompt: "gentle late-afternoon golden light, smooth luminous skin highlights and delicate warm reflections with natural shadow detail", settings: { azimuth: -45, elevation: 15, brightness: 65, lightColor: "#ffd28a", rimLight: false } },
  { id: "steel", label: "Xanh thép điện ảnh", prompt: "muted steel-blue and slate-grey cinematic lighting, controlled saturation, crisp tonal separation and subtle cool shadows", settings: { azimuth: 45, elevation: 25, brightness: 40, lightColor: "#b7c9db", rimLight: false } },
] as const;

const lightingSchema = z.object({
  azimuth: z.number().finite().transform(value => ((value + 180) % 360 + 360) % 360 - 180).catch(0),
  elevation: z.number().finite().transform(value => Math.max(-90, Math.min(90, value))).catch(0),
  brightness: z.number().finite().transform(value => Math.max(0, Math.min(100, value))).catch(50),
  lightColor: z.string().regex(/^(#[\da-f]{6})?$/i).transform(value => value || "#ffffff").catch("#ffffff"),
  rimLight: z.boolean().catch(false),
  rimAzimuth: z.number().finite().transform(value => ((value + 180) % 360 + 360) % 360 - 180).catch(-180),
  rimElevation: z.number().finite().transform(value => Math.max(-90, Math.min(90, value))).catch(20),
  rimBrightness: z.number().finite().transform(value => Math.max(0, Math.min(100, value))).catch(50),
  rimColor: z.string().regex(/^(#[\da-f]{6})?$/i).transform(value => value || "#ffffff").catch("#ffffff"),
  preset: z.string().refine(value => !value || lightingPresets.some(item => item.id === value)).catch(""),
  smartMode: z.boolean().catch(false),
  smartDesc: z.string().catch(""),
  model: z.string().catch(""),
  size: z.string().catch(""),
  ratio: z.string().catch(""),
});
export type LightingSettings = z.infer<typeof lightingSchema>;

export function readLightingSettings(value: unknown): LightingSettings {
  return lightingSchema.parse(value && typeof value === "object" && !Array.isArray(value) ? value : {});
}

export function getLightingPosition(azimuth: number, elevation: number) {
  const settings = readLightingSettings({ azimuth, elevation });
  const horizontal = settings.azimuth * Math.PI / 180;
  const vertical = settings.elevation * Math.PI / 180;
  return {
    x: Math.cos(vertical) * Math.sin(horizontal),
    y: Math.sin(vertical),
    z: Math.cos(vertical) * Math.cos(horizontal),
  };
}

export function getLightingDirection(azimuth: number, elevation: number, source: "key" | "rim" = "key") {
  const settings = readLightingSettings({ azimuth, elevation });
  const position = getLightingPosition(settings.azimuth, settings.elevation);
  const side = settings.azimuth < 0 ? "LEFT" : "RIGHT";
  const rear = Math.abs(settings.azimuth) > 90;
  const horizontal = settings.azimuth === 0 ? "on the reference-camera side of the subject"
    : settings.azimuth === -180 ? "behind the subject, opposite the reference camera"
      : Math.abs(settings.azimuth) === 90 ? `directly to reference-image ${side} of the subject`
        : `${rear ? "behind the subject" : "on the reference-camera side"}, toward reference-image ${side}`;
  const vertical = settings.elevation === 0 ? "at subject-center height"
    : `${Math.abs(settings.elevation)} degrees ${settings.elevation > 0 ? "above" : "below"} the horizontal plane through the subject center`;
  const placement = Math.abs(settings.elevation) === 90
    ? `directly ${settings.elevation > 0 ? "above" : "below"} the subject center`
    : `${horizontal}, ${vertical}`;
  const effect = rear && Math.abs(settings.elevation) < 90
    ? "This is backlighting: illuminate surfaces facing this rear source and visible silhouette edges, not frontal fill from the camera side."
    : "Illuminate surfaces facing this source; shadows fall away from the source according to the scene geometry.";
  return `Place the unseen ${source} light source ${placement}, at azimuth ${settings.azimuth} degrees and elevation ${settings.elevation} degrees. Its normalized source position is (${Number(position.x.toFixed(3))}, ${Number(position.y.toFixed(3))}, ${Number(position.z.toFixed(3))}), where +X is reference-image RIGHT, +Y is UP and +Z points toward the original camera. Light travels FROM this position TOWARD the subject center, not in the named source-side direction. ${effect}`;
}

export function buildLightingPrompt(value: LightingSettings) {
  const settings = readLightingSettings(value);
  const consistencyPrompt = [
    "Relight the reference image {{ref 1}} while keeping its original scene, composition, viewpoint and background geometry intact",
    "Retain every person's identity, facial features, hairstyle, clothing, pose and ongoing action",
    "Keep the original subject count, placement and relationships; do not introduce or remove people or objects",
    "Treat all lighting descriptions as illumination effects only; never depict lamps, spotlights, softboxes, reflectors, candles, torches or any lighting equipment",
    "Limit edits to illumination direction, intensity, color, shadow, contrast and atmosphere",
  ].join(". ");
  const presetPrompt = lightingPresets.find(item => item.id === settings.preset)?.prompt ?? "";
  const smartDesc = settings.smartMode ? settings.smartDesc.trim() : "";
  const lightDirectionPrompt = getLightingDirection(settings.azimuth, settings.elevation);
  const brightnessPrompt = [
    "very subdued exposure with deep shadows and only faint highlights",
    "restrained brightness with soft highlights and readable dark tones",
    "balanced exposure with natural midtones and preserved highlight detail",
    "bright illumination with open shadows and luminous midtones",
    "intense high-key exposure with radiant highlights and a light overall tone",
  ][Math.min(4, Math.floor(settings.brightness / 20))];
  const rimLightPrompt = settings.rimLight
    ? `use an independent source for rim and edge highlights where its specified position permits; do not move this source to the opposite side to create a rim; ${getLightingDirection(settings.rimAzimuth, settings.rimElevation, "rim")}; rim intensity ${Math.round(settings.rimBrightness)}%${settings.rimColor ? `, tinted toward ${settings.rimColor}` : ""}`
    : "";
  const lightColorPrompt = settings.lightColor ? `tint the key illumination toward ${settings.lightColor}, keeping the subject's original surface colors recognizable` : "";
  const lightingMeta = `[relight key azimuth:${Math.round(settings.azimuth)}deg elevation:${Math.round(settings.elevation)}deg intensity:${Math.round(settings.brightness)}% rim:${settings.rimLight ? `on azimuth:${Math.round(settings.rimAzimuth)}deg elevation:${Math.round(settings.rimElevation)}deg intensity:${Math.round(settings.rimBrightness)}% color:${settings.rimColor || "neutral"}` : "off"}]`;
  return [consistencyPrompt, presetPrompt, smartDesc, lightDirectionPrompt, brightnessPrompt, rimLightPrompt, lightColorPrompt, lightingMeta].filter(Boolean).join(", ");
}

/** Bắt buộc kèm thông số đang chọn, kể cả khi người dùng thay prompt ẩn. */
export function buildLightingParameters(value: LightingSettings) {
  const settings = readLightingSettings(value);
  const keyPosition = getLightingPosition(settings.azimuth, settings.elevation);
  const formatPosition = (position: ReturnType<typeof getLightingPosition>) =>
    `(${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`;
  return [
    "LIGHTING CONTROL VALUES — apply these actual slider settings to reference image {{ref 1}}; they take precedence over any conflicting stylistic descriptions.",
    "Coordinate system: +X = right of original image, +Y = up, +Z = toward original camera; the subject center is the origin.",
    `Key light: azimuth=${settings.azimuth}°, elevation=${settings.elevation}°, intensity=${settings.brightness}%, color=${settings.lightColor}, normalized position=${formatPosition(keyPosition)}.`,
    settings.rimLight
      ? `Rim light: ON, azimuth=${settings.rimAzimuth}°, elevation=${settings.rimElevation}°, intensity=${settings.rimBrightness}%, color=${settings.rimColor}, normalized position=${formatPosition(getLightingPosition(settings.rimAzimuth, settings.rimElevation))}.`
      : "Rim light: OFF; do not add a separate rim source.",
    `Selected lighting preset: ${settings.preset || "custom"}; smart mode: ${settings.smartMode ? "ON" : "OFF"}.`,
    settings.smartMode && settings.smartDesc.trim() ? `Additional lighting directions: ${settings.smartDesc.trim()}` : "",
    "These percentages are requested relative illumination strengths, not calibrated physical lux values. Change lighting only; keep subjects, clothing, framing and background geometry unchanged.",
  ].filter(Boolean).join("\n");
}

/** Các giá trị thực từ thanh trượt, dùng trong mẫu prompt tùy chỉnh. */
export function getLightingPromptVariables(value: LightingSettings) {
  const settings = readLightingSettings(value);
  return {
    keyAzimuth: settings.azimuth,
    keyElevation: settings.elevation,
    keyIntensity: settings.brightness,
    keyColor: settings.lightColor,
    rimEnabled: settings.rimLight ? "on" : "off",
    rimAzimuth: settings.rimAzimuth,
    rimElevation: settings.rimElevation,
    rimIntensity: settings.rimBrightness,
    rimColor: settings.rimColor,
    preset: settings.preset || "custom",
    smartMode: settings.smartMode ? "on" : "off",
  };
}
