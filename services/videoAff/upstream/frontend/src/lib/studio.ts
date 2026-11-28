import type { BriefRecord, Keyframe, PipelineRun } from "../types/studio";

export type StepId = "idea" | "images";
export const STEPS: { id: StepId; label: string }[] = [
  { id: "idea", label: "Ý tưởng" },
  { id: "images", label: "Cảnh và video" },
];

/** What the server is doing, in words a marketer uses. */
export const PIPELINE_LABELS = {
  script: "Đang viết kịch bản",
  firstImage: "Đang tạo ảnh đầu tiên",
  images: "Đang tạo các cảnh còn lại",
  clips: "Đang tạo các đoạn phim",
  voice: "Đang tạo lời đọc",
  video: "Đang ghép video",
  caption: "Đang viết mô tả bài đăng",
};

export function pipelineStage(step: string): keyof typeof PIPELINE_LABELS | undefined {
  const text = step.toLowerCase();
  if (text.includes("storyboard") || text.includes("reference")) return "script";
  if (text.includes("master")) return "firstImage";
  if (text.includes("keyframe")) return "images";
  if (text.includes("clip")) return "clips";
  if (text.includes("voice")) return "voice";
  if (text.includes("stitching")) return "video";
  if (text.includes("caption")) return "caption";
}

export function friendlyStep(step: string): string {
  const stage = pipelineStage(step);
  return stage ? PIPELINE_LABELS[stage] : "Đang bắt đầu";
}

/** The last run did not finish: it needs a look, failed, or was cut off by a restart. */
export const runStopped = (run: PipelineRun | undefined) => !!run && ["paused", "failed", "interrupted"].includes(run.status);

export function runStoppedMessage(run: PipelineRun): string {
  const { message } = run;
  if (message.startsWith("Approve the first image")) return "Hãy duyệt ảnh cảnh đầu để tạo các ảnh còn lại.";
  if (message.startsWith("Approve the images")) return "Hãy duyệt tất cả ảnh trước khi dựng video.";
  if (message.startsWith("Master keyframe failed")) return "Chưa tạo được ảnh cảnh đầu. Hãy thử lại ở cảnh đó.";
  if (message.startsWith("The clip of shot")) return "Có đoạn phim cần kiểm tra. Hãy mở danh sách cảnh để xử lý.";
  if (message.startsWith("The clips are still being made")) return "Các đoạn phim đang được tạo. Hãy quay lại trang này sau.";
  if (message.startsWith("No usable reference image")) return "Hãy lấy và kiểm tra ảnh bối cảnh trong Bộ nhớ AI trước.";
  if (message.startsWith("No text embedding model")) return "VideoAFF chưa được cấu hình để tìm ảnh bối cảnh.";
  if (message.startsWith("LLM is not configured")) return "Hãy mở Mô hình và Kho để kiểm tra mô hình Viết kịch bản của VideoAFF.";
  if (message.startsWith("Upload the photo")) return "Hãy thêm ảnh nhân vật trước khi tạo video.";
  if (run.status === "interrupted") return "Lần chạy trước bị gián đoạn. Hãy chạy lại để tiếp tục.";
  return "Lần chạy trước đã dừng. Hãy xem chi tiết và thử lại bước đang làm.";
}

/** The AI check could not run, so a person has to look at the picture or clip. */
export const isUnchecked = (problem: string) => problem.startsWith("Not checked");

/** What to tell the person about the AI check of one picture or clip. */
export const checkNote = (problem: string) => (problem ? (isUnchecked(problem) ? "AI chưa kiểm tra được. Bạn có thể tự kiểm tra cảnh này." : `AI đề nghị kiểm tra lại: ${problem}`) : "AI chưa phát hiện vấn đề");

export function imagesApproved(brief: BriefRecord | null | undefined, keyframes: Keyframe[]): boolean {
  const shots = brief?.brief.shots?.length ?? 0;
  return shots > 0 && Array.from({ length: shots }, (_, index) => keyframes.find((k) => k.shot_index === index)?.status === "approved").every(Boolean);
}

export function doneSteps(brief: BriefRecord | null | undefined, keyframes: Keyframe[], hasVideo: boolean): Record<StepId, boolean> {
  return { idea: !!brief, images: hasVideo };
}

/** The step a person most likely wants next: scenes and video are one page. */
export const suggestedStep = (brief: BriefRecord | null | undefined): StepId => (brief ? "images" : "idea");

/** A product can have many videos: the id of a video is the product id, then "-v" and a suffix. */
export const productOf = (projectId: string) => projectId.split("-v")[0];
export const newProjectId = (productId: string) => `${productId}-v${Date.now().toString(36)}`;

export const toNumber = (value: number | string | null | undefined) => Number(String(value ?? 0).replace(/[.,]/g, "")) || 0;
export const vnd = (value: string | null | undefined) => (value ? `${toNumber(value).toLocaleString("vi-VN")} ₫` : "");
