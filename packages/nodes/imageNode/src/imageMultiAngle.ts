import { z } from "@toonflow/nodes-scaffold/runtime";

export const multiAnglePresets = [
  { id: "front", label: "正面", settings: { azimuth: 0, elevation: 0 } },
  { id: "back", label: "背面", settings: { azimuth: -180, elevation: 0 } },
  { id: "leftFront", label: "左前", settings: { azimuth: -45, elevation: 0 } },
  { id: "rightFront", label: "右前", settings: { azimuth: 45, elevation: 0 } },
  { id: "left", label: "左侧", settings: { azimuth: -90, elevation: 0 } },
  { id: "right", label: "右侧", settings: { azimuth: 90, elevation: 0 } },
  { id: "leftBack", label: "左后", settings: { azimuth: -135, elevation: 0 } },
  { id: "rightBack", label: "右后", settings: { azimuth: 135, elevation: 0 } },
  { id: "high", label: "俯拍", settings: { azimuth: 0, elevation: 60 } },
  { id: "low", label: "仰拍", settings: { azimuth: 0, elevation: -60 } },
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
  return distance <= 3.5 ? "近景" : distance >= 7 ? "远景" : "中景";
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
  if (typeof document !== "undefined" && document.documentElement.lang === "vi") {
    const side = settings.azimuth < 0 ? "trái" : "phải";
    const horizontalVi = settings.azimuth === 0
      ? "Giữ vị trí camera trên trục nhìn ngang ban đầu."
      : settings.azimuth === -180
        ? "GÓC NHÌN NGƯỢC: di chuyển camera đúng 180 độ quanh chủ thể tới phía đối diện hoàn toàn so với vị trí gốc; hiển thị những mặt vốn quay lưng về camera tham chiếu."
        : rearView
          ? `GÓC NHÌN PHÍA SAU: di chuyển camera ${Math.abs(settings.azimuth)} độ về bên ${side} của ảnh tham chiếu, vượt qua góc bên tới nửa không gian phía sau. Vị trí camera còn cách hướng đối diện hoàn toàn ${180 - Math.abs(settings.azimuth)} độ; nhìn về tâm chủ thể. Cần tái hiện các bề mặt trước đó bị che khuất thay vì lặp lại góc chính diện hay góc bên.`
          : `Di chuyển chính CAMERA ${Math.abs(settings.azimuth)} độ quanh chủ thể về mép ${side} của ảnh tham chiếu, hướng ống kính về tâm chủ thể. Đây là thay đổi vị trí camera, không phải xoay người hoặc di chuyển vật thể trong ảnh.`;
    const verticalVi = settings.elevation === 0
      ? "Giữ góc nhìn theo phương dọc ban đầu."
      : `Đặt camera ${Math.abs(settings.elevation)} độ ${settings.elevation > 0 ? "phía trên mặt phẳng nhìn gốc, ống kính hướng xuống" : "phía dưới mặt phẳng nhìn gốc, ống kính hướng lên"} để ngắm tâm chủ thể.`;
    const visibilityVi = rearView
      ? "Tái dựng bề mặt chưa thấy dựa trên đặc điểm tham chiếu. Không cần giữ khuôn mặt gốc luôn nhìn thấy: đầu, thân và vật thể có thể che khuất nhau một cách tự nhiên. Nếu ảnh gốc nhìn người từ trước, góc gần 180 độ phải thấy phía sau đầu, tóc, vai và quần áo; không quay đầu người về camera mới hoặc sao chép mặt và chi tiết áo trước sang mặt sau. Nếu ảnh gốc chụp từ sau lưng thì góc ngược có thể cho thấy phía trước."
      : "Hiển thị bề mặt, vùng che khuất và phối cảnh hậu cảnh đúng với vị trí camera mới.";
    return [
      `Chụp lại khung cảnh trong ảnh {{ref 1}} từ VỊ TRÍ CAMERA MỚI. ${horizontalVi} ${verticalVi} Chỉ di chuyển camera; giữ nguyên hướng thế giới của chủ thể và bối cảnh.`,
      `Dùng ảnh tham chiếu làm hệ tọa độ: +X hướng sang mép phải ảnh, +Y hướng lên, +Z hướng về camera ban đầu. Tâm chủ thể là (0, 0, 0), camera gốc tại (0, 0, 4.8), camera mới tại (${Number(position.x.toFixed(3))}, ${Number(position.y.toFixed(3))}, ${Number(position.z.toFixed(3))}), hướng nhìn vào (0, 0, 0).`,
      `Khoảng cách camera: ${settings.distance.toFixed(1)} đơn vị chuẩn hóa (khoảng cách gốc 4.8), bằng ${(settings.distance / 4.8).toFixed(2)} lần khoảng cách tham chiếu. Dùng tiêu cự tương đương ${multiAngleFocalLengths[settings.lens]} mm, ${settings.lens === "wide" ? "ống kính góc rộng không méo mắt cá" : "ống kính tiêu chuẩn"}.`,
      `Giữ nguyên các chủ thể, danh tính, số lượng, trang phục, tóc, màu, vật liệu và phong cách. ${visibilityVi} Cập nhật phối cảnh nền theo camera mới. Không lật gương, đổi trái/phải giải phẫu, hoặc chỉ bóp méo phối cảnh phẳng thay vì tạo góc nhìn mới. Xuất một ảnh hoàn chỉnh, không thêm camera, đường dẫn hoặc nhãn chữ.`,
    ].join("\n");
  }
  return [
    `Photograph the scene in reference image {{ref 1}} from a NEW CAMERA POSITION. ${horizontal} ${vertical} Move only the camera; keep the subject and scene in their original world orientation.`,
    `Use the reference image as the coordinate basis: +X points to its right edge, +Y points up, +Z points toward the original camera. The subject center is (0, 0, 0), the original camera is (0, 0, 4.8), and the new camera is (${Number(position.x.toFixed(3))}, ${Number(position.y.toFixed(3))}, ${Number(position.z.toFixed(3))}), looking at (0, 0, 0).`,
    `Camera distance: ${settings.distance.toFixed(1)} normalized units, where the reference distance is 4.8; use ${(settings.distance / 4.8).toFixed(2)} times the reference camera-to-subject distance. Use a ${multiAngleFocalLengths[settings.lens]}mm equivalent ${lens}.`,
    `Preserve the same subjects, identities, number, clothing, hairstyles, colors, materials and visual style. ${visibility} Update the background perspective for the new camera position. Do not mirror the image, swap anatomical left and right, or use a flat perspective warp instead of a new viewpoint. Output one finished image without added cameras, guides or text labels.`,
  ].join("\n");
}
