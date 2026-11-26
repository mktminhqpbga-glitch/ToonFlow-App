import type { NodeMediaModel } from "@toonflow/nodes-scaffold/nodeAi";
import { describeStudioError, requestStudio, StudioRequestError } from "./studioRequests";
import { buildFlowPrompt, flowFileSchema, type FlowItem, type FlowMediaFile, type MediaAttempt, type VideoFlowRequest, type VideoFlowRun } from "./videoFlow";

type MediaStatus = {
  taskId: string;
  state: "queued" | "running" | "interrupted" | "succeeded" | "failed" | "cancelled";
  resumable?: boolean;
  result?: { code: number; message?: string; data?: FlowMediaFile[] | null };
};
export class VideoFlowTaskError extends Error {
  constructor(message: string, readonly uncertain = false, readonly replaceable = false) { super(message); }
}

function modes(model: NodeMediaModel) { return (Array.isArray(model.mode) ? model.mode : []).filter((value): value is string => typeof value === "string"); }

function photoCapacity(model: NodeMediaModel) {
  const available = modes(model);
  return model.referenceLimits?.maxReferences ?? (available.includes("multiReference") ? 4 : available.includes("singleImage") ? 1 : 0);
}

export function supportsFlowPhotos(model: NodeMediaModel, count: number) {
  if (count) return photoCapacity(model) >= count;
  const available = modes(model);
  return !available.length || available.includes("text");
}

export function videoImageMode(model: NodeMediaModel): VideoFlowRequest["mode"] {
  const available = modes(model);
  if (available.includes("startFrameOptional")) return "startFrameOptional";
  if (available.includes("endFrameOptional")) return "endFrameOptional";
  if (available.includes("singleImage")) return "singleImage";
  return undefined;
}

export function makeMediaRequest(run: VideoFlowRun, item: FlowItem, model: NodeMediaModel, kind: "image" | "video"): VideoFlowRequest {
  const step = run.template.steps[kind === "image" ? 1 : 2]!;
  const { ratio, size, duration, resolution } = step.options;
  const request: VideoFlowRequest = {
    mediaType: kind, providerId: model.providerId, modelId: model.modelId, prompt: buildFlowPrompt(run, item, kind),
  };
  if (ratio) {
    if (!model.imageRatios?.includes(ratio)) throw new Error("Mô hình đã chọn không nhận tỷ lệ khung hình trong mẫu luồng.");
    request.ratio = ratio;
  }
  const referenceLimits = model.referenceLimits;
  if (kind === "image") {
    if (size) {
      if (!model.imageSizes?.includes(size)) throw new Error("Mô hình ảnh không nhận độ phân giải trong mẫu luồng.");
      request.size = size;
    }
    const photos = [...run.input.references, ...run.input.products];
    const count = photoCapacity(model);
    if (!photos.length && !supportsFlowPhotos(model, 0)) throw new Error("Mô hình ảnh này cần ảnh đầu vào. Hãy thêm ảnh hoặc chọn mô hình ảnh khác trong phần Nâng cao.");
    if (photos.length > count) {
      throw new Error(count ? "Mô hình ảnh này nhận tối đa " + count + " ảnh. Hãy chọn mô hình ảnh hỗ trợ nhiều ảnh hơn trong phần Nâng cao."
        : "Mô hình ảnh này không hỗ trợ ảnh đầu vào. Hãy đổi mô hình ảnh trong phần Nâng cao.");
    }
    const incompatible = photos.find(photo => (referenceLimits?.allowedMimeTypes && !referenceLimits.allowedMimeTypes.includes(photo.mimeType))
      || (referenceLimits && photo.bytes > referenceLimits.maxReferenceBytes));
    if (incompatible) throw new Error("Ảnh “" + incompatible.name + "” vượt giới hạn định dạng hoặc dung lượng của mô hình ảnh đã chọn.");
    if (photos.length) request.images = photos.map(({ path, mimeType }) => ({ path, mimeType }));
    return request;
  }
  const mode = videoImageMode(model);
  if (!item.frame || !mode) throw new Error("Hãy chọn mô hình video nhận được một ảnh khung hình đầu.");
  const { path, mimeType } = item.frame;
  if (referenceLimits && (!referenceLimits.maxReferences || !referenceLimits.allowedMimeTypes.includes(mimeType))) {
    throw new Error("Mô hình video này không nhận định dạng ảnh khung đầu. Hãy đổi mô hình video trong phần Nâng cao.");
  }
  const combinations = model.durationResolutionMap ?? [];
  if ((duration || resolution) && !combinations.some(entry => (!duration || entry.duration.includes(duration)) && (!resolution || entry.resolution.includes(resolution)))) {
    throw new Error("Mô hình video không hỗ trợ thời lượng hoặc độ phân giải trong mẫu luồng.");
  }
  if (duration) request.duration = duration;
  if (resolution) request.resolution = resolution;
  request.mode = mode;
  request.firstFrame = { path, mimeType };
  return request;
}

function wait(ms: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

const rejectedStatuses = [400, 401, 403, 404, 405, 413, 415, 422, 429];
export async function finishFlowMedia(directory: string, attempt: MediaAttempt, existing: boolean, signal: AbortSignal,
  onState: (state: "queued" | "running") => Promise<void>) {
  const deadline = Date.now() + 25 * 60_000;
  const status = (resume: boolean) => requestStudio<MediaStatus[]>("/api/ai/media/tasks/status", {
    method: "POST", body: JSON.stringify({ directory, taskIds: [attempt.id], resume }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  }).then(result => {
    const value = result.find(task => task.taskId === attempt.id);
    if (!value) throw new Error("Máy chủ trả thiếu trạng thái tác vụ.");
    return value;
  });
  async function submit() {
    const data = await requestStudio<{ taskId: string }>("/api/ai/media/generate", {
      method: "POST", body: JSON.stringify({
        ...attempt.request, directory, taskId: attempt.id, studioQueue: true, outputDirectory: "assets/generated",
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    });
    if (data.taskId !== attempt.id) throw new Error("Máy chủ trả mã tác vụ khác mã đã lưu.");
  }
  let item: MediaStatus | undefined;
  let submissionIssue = "";
  try {
    if (existing) item = await status(true);
    // ACT: Chỉ gửi lại cùng mã và dữ liệu khi máy chủ chưa có bản ghi.
    if (!item || (item.state === "interrupted" && item.result?.code === 404)) {
      await submit();
      item = undefined;
    }
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof StudioRequestError && rejectedStatuses.includes(error.status) && (!existing || item?.result?.code === 404)) {
      throw new VideoFlowTaskError(error.message);
    }
    item = undefined;
    submissionIssue = error instanceof Error ? error.message : "";
  }
  let offlineSince: number | undefined;
  let missingSince = 0;
  let resumeSince = 0;
  let tryResume = existing;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    if (!item) {
      try { item = await status(tryResume); offlineSince = undefined; }
      catch {
        signal.throwIfAborted();
        offlineSince ??= Date.now();
        if (Date.now() - offlineSince > 20_000) break;
      }
    }
    if (item) {
      const { state, result, resumable } = item;
      if (state === "succeeded") {
        const file = flowFileSchema.safeParse(result?.code === 200 && Array.isArray(result.data)
          ? result.data.find(file => file?.mediaType === attempt.request.mediaType) : undefined);
        if (!file.success) throw new VideoFlowTaskError("Tác vụ đã kết thúc nhưng thiếu tệp kết quả. Hãy chạy lại bước này.");
        return file.data;
      }
      if (state === "failed" || state === "cancelled") {
        throw new VideoFlowTaskError(state === "cancelled" ? "Tác vụ đã bị hủy. Bạn có thể chạy lại bước này." : describeStudioError(result?.message));
      }
      if (state === "interrupted") {
        if (result?.code === 404) {
          missingSince ||= Date.now();
          if (Date.now() - missingSince > 8_000) {
            throw new VideoFlowTaskError("Máy chủ chưa thấy tác vụ. Bấm “Kiểm tra lại” để dùng lại mã đã lưu." + (submissionIssue ? " " + submissionIssue : ""), true);
          }
        } else if (!resumable) {
          throw new VideoFlowTaskError("Chưa xác nhận được kết quả từ nhà cung cấp. " + describeStudioError(result?.message), true, true);
        } else {
          tryResume = true;
          resumeSince ||= Date.now();
          if (Date.now() - resumeSince > 30_000) {
            throw new VideoFlowTaskError("Tác vụ đang gián đoạn. Hãy đợi hàng chờ có chỗ rồi bấm “Kiểm tra lại”.", true);
          }
        }
      } else if (state === "queued" || state === "running") {
        missingSince = resumeSince = 0;
        tryResume = false;
        await onState(state);
      } else throw new VideoFlowTaskError("Máy chủ trả trạng thái tác vụ không hợp lệ.", true);
      item = undefined;
    }
    await wait(2000, signal);
  }
  throw new VideoFlowTaskError(offlineSince ? "Kết nối bị gián đoạn. Bấm “Kiểm tra lại” để lấy kết quả của tác vụ này."
    : "Đã hết thời gian chờ kết quả. Bấm “Kiểm tra lại” để theo dõi tiếp tác vụ này.", true);
}
