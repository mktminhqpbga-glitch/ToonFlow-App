import { z } from "@toonflow/nodes-scaffold/runtime";

export const multiAnglePresets = [
  { id: "front", label: "Chính diện", settings: { azimuth: 0, elevation: 0 } },
  { id: "back", label: "Mặt sau", settings: { azimuth: -180, elevation: 0 } },
  { id: "leftFront", label: "Trước trái", settings: { azimuth: -45, elevation: 0 } },
  { id: "rightFront", label: "Trước phải", settings: { azimuth: 45, elevation: 0 } },
  { id: "left", label: "Bên trái", settings: { azimuth: -90, elevation: 0 } },
  { id: "right", label: "Bên phải", settings: { azimuth: 90, elevation: 0 } },
  { id: "leftBack", label: "Sau trái", settings: { azimuth: -135, elevation: 0 } },
  { id: "rightBack", label: "Sau phải", settings: { azimuth: 135, elevation: 0 } },
  { id: "high", label: "Từ trên", settings: { azimuth: 0, elevation: 60 } },
  { id: "low", label: "Từ dưới", settings: { azimuth: 0, elevation: -60 } },
] as const;

export const multiAngleFocalLengths = { standard: 50, wide: 24 } as const;

const multiAngleSchema = z.object({
  azimuth: z.number().finite().transform(value => ((value + 180) % 360 + 360) % 360 - 180).catch(0),
  elevation: z.number().finite().transform(value => Math.max(-80, Math.min(80, value))).catch(0),
  distance: z.number().finite().transform(value => Math.max(2, Math.min(10, value))).catch(4.8),
  lens: z.enum(["standard", "wide"]).catch("standard"),
  viewMode: z.enum(["orbit", "camera"]).catch("orbit"),
  model: z.string().catch(""),
  size: z.string().catch(""),
  ratio: z.string().catch(""),
});

export type MultiAngleSettings = z.infer<typeof multiAngleSchema>;

export function readMultiAngleSettings(value: unknown): MultiAngleSettings {
  return multiAngleSchema.parse(value && typeof value === "object" && !Array.isArray(value) ? value : {});
}

export function getMultiAngleShot(distance: number) {
  return distance <= 3.5 ? "Cận cảnh" : distance >= 7 ? "Toàn cảnh" : "Trung cảnh";
}

/** Chỉ dùng prompt riêng của preset khi đúng các thông số mặc định của nút đó. */
export function getMultiAnglePromptId(value: MultiAngleSettings) {
  const settings = readMultiAngleSettings(value);
  const preset = multiAnglePresets.find(item =>
    item.settings.azimuth === settings.azimuth && item.settings.elevation === settings.elevation);
  return preset && settings.distance === 4.8 && settings.lens === "standard"
    ? `camera.${preset.id}`
    : "camera.custom";
}

export function getMultiAngleCameraPosition(value: Pick<MultiAngleSettings, "azimuth" | "elevation" | "distance">) {
  const settings = readMultiAngleSettings(value);
  const azimuth = settings.azimuth * Math.PI / 180;
  const elevation = settings.elevation * Math.PI / 180;
  return {
    x: settings.distance * Math.cos(elevation) * Math.sin(azimuth),
    y: settings.distance * Math.sin(elevation),
    z: settings.distance * Math.cos(elevation) * Math.cos(azimuth),
  };
}

/** Các biến động dùng được khi sửa prompt của nút trong Cài đặt → Prompt. */
export function getMultiAnglePromptVariables(value: MultiAngleSettings) {
  const settings = readMultiAngleSettings(value);
  const position = getMultiAngleCameraPosition(settings);
  return {
    azimuth: settings.azimuth,
    elevation: settings.elevation,
    distance: settings.distance.toFixed(1),
    lensMm: multiAngleFocalLengths[settings.lens],
    lensType: settings.lens,
    cameraX: position.x.toFixed(3),
    cameraY: position.y.toFixed(3),
    cameraZ: position.z.toFixed(3),
  };
}

export function buildMultiAnglePrompt(value: MultiAngleSettings) {
  const settings = readMultiAngleSettings(value);
  const position = getMultiAngleCameraPosition(settings);
  const cameraSide = settings.azimuth < 0 ? "LEFT" : "RIGHT";
  const aimSide = settings.azimuth < 0 ? "RIGHT" : "LEFT";
  const rearView = Math.abs(settings.azimuth) > 90;
  const horizontal = settings.azimuth === 0
    ? "Keep the camera on the original horizontal viewing axis."
    : settings.azimuth === -180
      ? "REVERSE VIEW: move the camera 180 degrees around the subject to the exact opposite side of the original camera. Show the surfaces facing away from the reference camera."
      : rearView
        ? `REAR VIEW relative to the reference camera: orbit ${Math.abs(settings.azimuth)} degrees toward reference-image ${cameraSide}, continuing PAST the side view into the rear hemisphere. The camera is ${180 - Math.abs(settings.azimuth)} degrees short of the exact opposite viewpoint, on its ${cameraSide} side, looking back toward the subject center. Reveal the surfaces hidden from the reference camera instead of repeating its front or side view.`
        : `Move the CAMERA ${Math.abs(settings.azimuth)} degrees around the subject toward the ${cameraSide} edge of the reference image. The camera is physically on the reference-image ${cameraSide} side, with its lens aimed ${aimSide} toward the subject center. These are camera positions, not instructions to turn the subject or move it within the frame.`;
  const vertical = settings.elevation === 0
    ? "Keep the original vertical camera angle."
    : `Place the camera ${Math.abs(settings.elevation)} degrees ${settings.elevation > 0 ? "above the original viewing plane, with the lens aimed DOWN" : "below the original viewing plane, with the lens aimed UP"} toward the subject center.`;
  const lens = settings.lens === "wide" ? "wide-angle lens without fisheye distortion" : "standard lens";
  const visibility = rearView
    ? "Reconstruct the previously unseen surfaces consistently with the reference. Identity consistency does not require the original face to remain visible: allow the head, body and objects to occlude features naturally. When the reference shows a person from the front, a near-180-degree view shows the back of the head, hair, shoulders and clothing; do not turn the head toward the new camera or copy facial features and front clothing details onto the back. If the reference already shows the person's back, the reverse view may reveal their front."
    : "Render the requested viewpoint with corresponding changes to visible surfaces, occlusion and background perspective.";
  return [
    `Photograph the scene in reference image {{ref 1}} from a NEW CAMERA POSITION. ${horizontal} ${vertical} Move only the camera; keep the subject and scene in their original world orientation.`,
    `Use the reference image as the coordinate basis: +X points to its right edge, +Y points up, +Z points toward the original camera. The subject center is (0, 0, 0), the original camera is (0, 0, 4.8), and the new camera is (${Number(position.x.toFixed(3))}, ${Number(position.y.toFixed(3))}, ${Number(position.z.toFixed(3))}), looking at (0, 0, 0).`,
    `Camera distance: ${settings.distance.toFixed(1)} normalized units, where the reference distance is 4.8; use ${(settings.distance / 4.8).toFixed(2)} times the reference camera-to-subject distance. Use a ${multiAngleFocalLengths[settings.lens]}mm equivalent ${lens}.`,
    `Preserve the same subjects, identities, number, clothing, hairstyles, colors, materials and visual style. ${visibility} Update the background perspective for the new camera position. Do not mirror the image, swap anatomical left and right, or use a flat perspective warp instead of a new viewpoint. Output one finished image without added cameras, guides or text labels.`,
  ].join("\n");
}

/** Thông số camera phải theo yêu cầu ngay cả khi prompt của nút bị thay toàn bộ. */
export function buildMultiAngleParameters(value: MultiAngleSettings) {
  const settings = readMultiAngleSettings(value);
  const position = getMultiAngleCameraPosition(settings);
  return [
    "CAMERA CONTROL VALUES — apply these actual camera controls to reference image {{ref 1}} even if styling text conflicts.",
    "Original camera position: (0, 0, 4.8), target: (0, 0, 0). +X is original-image right; +Y is up; +Z is toward the original camera.",
    `Camera orbit: azimuth=${settings.azimuth}°, elevation=${settings.elevation}°, distance=${settings.distance.toFixed(1)} normalized units; new position=(${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)}).`,
    `Lens: ${multiAngleFocalLengths[settings.lens]}mm equivalent (${settings.lens}); subject stays fixed in world space; move only the camera and reconstruct the newly visible surfaces.`,
  ].join("\n");
}
