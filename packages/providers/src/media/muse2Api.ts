const rules = [
  {
    type: "input",
    field: "baseUrl" as const,
    title: "Base URL Muse2API",
    value: "http://127.0.0.1:18610/v1",
    props: { placeholder: "http://127.0.0.1:18610/v1" },
  },
  {
    type: "input",
    field: "apiKey" as const,
    title: "Muse2API API Key",
    value: "",
    props: { type: "password", showPassword: true, autocomplete: "off" },
  },
] as const;

const maxImageReferences = 20;
const maxLegacyReferences = 4;

type MuseContext = ProviderContext<ProviderConfig<typeof rules>>;
type MuseKind = "image" | "video";
type MuseProtocol = "python04" | "python04alias" | "vip0014" | "mac2api";
type MuseTask = {
  transport: "muse2Api";
  kind: MuseKind;
  serviceUrl: string;
  idempotencyKey: string;
  protocol?: MuseProtocol;
  taskId?: string;
  payload?: ProviderTaskData;
};

function connection(context: MuseContext) {
  const url = new URL(context.config.baseUrl.trim());
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Base URL Muse2API phải là HTTP/HTTPS, không chứa thông tin đăng nhập, query hoặc fragment.");
  }
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/v1") ? path : `${path}/v1`;
  const apiKey = context.config.apiKey.trim();
  if (!apiKey) throw new Error("Hãy nhập API Key của Muse2API.");
  return { baseUrl: url.href.replace(/\/+$/, ""), headers: { Authorization: `Bearer ${apiKey}` } };
}

function requestSignal(context: MuseContext, milliseconds = 60000) {
  const timeout = AbortSignal.timeout(milliseconds);
  return context.signal ? AbortSignal.any([context.signal, timeout]) : timeout;
}

async function serviceProtocol(context: MuseContext): Promise<MuseProtocol> {
  const url = new URL(connection(context).baseUrl);
  url.pathname = "/healthz";
  try {
    const response = await context.tool.fetch(url.href, {
      method: "GET", signal: requestSignal(context, 8000), redirect: "error",
    });
    if (!response.ok) return "vip0014";
    const result = await response.json().catch(() => null) as { version?: unknown } | null;
    // Python www222fff 0.4.0 and Go vip0014 expose different media schemas.
    if (result?.version === "0.4.0") {
      // The *running* Python 0.4.0 has a local /images/tasks extension not
      // present in upstream tag 0.4.0. Preserve its existing API endpoint when
      // the OpenAPI document confirms that exact POST route.
      const schemaUrl = new URL(connection(context).baseUrl);
      schemaUrl.pathname = "/openapi.json";
      const schemaResponse = await context.tool.fetch(schemaUrl.href, {
        method: "GET", signal: requestSignal(context, 8000), redirect: "error",
      });
      if (!schemaResponse.ok) return "python04";
      const schema = await schemaResponse.json().catch(() => null) as {
        paths?: { [path: string]: { post?: unknown } };
      } | null;
      return schema?.paths?.["/v1/images/tasks"]?.post ? "python04alias" : "python04";
    }
    if (typeof result?.version === "string" && /^0\./.test(result.version)) {
      throw new Error(`Muse2API Python ${result.version} chưa được kiểm tra tương thích ảnh/video. Tác vụ chưa được gửi.`);
    }
    return "vip0014";
  } catch (error) {
    context.signal?.throwIfAborted();
    // Don't silently send a Go-shaped payload to Python when protocol probing
    // fails: the other reference images would otherwise be silently ignored.
    throw new Error("Chưa xác minh được phiên bản Muse2API để gửi đúng ảnh tham chiếu. Tác vụ chưa được gửi.", { cause: error });
  }
}

async function assertServiceReady(context: MuseContext): Promise<MuseProtocol> {
  const url = new URL(connection(context).baseUrl);
  url.pathname = "/readyz";
  let response: Response;
  try {
    response = await context.tool.fetch(url.href, { method: "GET", signal: requestSignal(context, 8000), redirect: "error" });
  } catch (error) {
    context.signal?.throwIfAborted();
    throw new Error("Không kiểm tra được Muse2API/Chrome. Tác vụ chưa được gửi. Hãy kiểm tra dịch vụ rồi thử lại.", { cause: error });
  }
  // Một số bản Muse2API cũ không có /readyz. Giữ tương thích với chúng;
  // chỉ chặn khi dịch vụ cung cấp trạng thái driver rõ ràng.
  if (response.status === 404) return serviceProtocol(context);
  if (!response.ok) throw new Error(`Muse2API chưa sẵn sàng (HTTP ${response.status}). Tác vụ chưa được gửi.`);
  const data = await response.json().catch(() => null) as { ready?: unknown; driver?: { ok?: unknown } } | null;
  if (data?.driver?.ok === false) {
    throw new Error("Muse2API đã mất kết nối điều khiển Chrome/CDP. Tác vụ chưa được gửi. Hãy khôi phục phiên Chrome của Muse2API rồi đợi /readyz báo ready=true.");
  }
  if (data?.ready === false) throw new Error("Muse2API chưa sẵn sàng. Tác vụ chưa được gửi; kiểm tra trạng thái driver và tài khoản trong Muse2API.");
  return serviceProtocol(context);
}

async function jsonRequest(context: MuseContext, path: string, payload?: ProviderTaskData, key?: string): Promise<Record<string, any>> {
  const { baseUrl, headers } = connection(context);
  const response = await context.tool.fetch(`${baseUrl}${path}`, {
    method: payload ? "POST" : "GET",
    headers: { ...headers, ...(payload ? { "Content-Type": "application/json" } : {}), ...(key ? { "Idempotency-Key": key } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: requestSignal(context),
    redirect: "error",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(context.tool.errorMessage(data) || `Muse2API: HTTP ${response.status}`), { status: response.status });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Muse2API trả về JSON không hợp lệ.");
  return data;
}

async function imageProtocol(context: MuseContext, count: number): Promise<MuseProtocol | undefined> {
  if (count > maxImageReferences) {
    throw Object.assign(new Error(`Chọn tối đa ${maxImageReferences} ảnh tham chiếu cho một tác vụ tạo ảnh.`), { code: "MEDIA_TASK_FAILED" });
  }
  if (count <= maxLegacyReferences && !context.config.apiKey.trim().startsWith("m2c_")) return undefined;
  let capability;
  try {
    capability = await jsonRequest(context, "/capabilities");
  } catch (cause) {
    context.signal?.throwIfAborted();
    const message = count > maxLegacyReferences
      ? "Để gửi hơn 4 ảnh, hãy dùng máy chủ mac2API hỗ trợ nhiều ảnh và khóa người dùng m2c_."
      : "Chưa xác minh được khả năng tạo ảnh của mac2API. Hãy kiểm tra Base URL và khóa người dùng m2c_.";
    throw Object.assign(new Error(`${message} Tác vụ chưa được gửi.`, { cause }),
      { code: "MEDIA_TASK_FAILED" });
  }
  const model = Array.isArray(capability.models) && capability.models.find(item => item?.id === "muse-image");
  if (capability.contractVersion !== 1 || capability.features?.idempotency !== true || !model || !Number.isInteger(model.maxReferences)) {
    throw Object.assign(new Error("Máy chủ chưa xác nhận giới hạn ảnh tham chiếu của mô-đun. Tác vụ chưa được gửi."), { code: "MEDIA_TASK_FAILED" });
  }
  if (count > model.maxReferences) {
    throw Object.assign(new Error(`Máy chủ mac2API cho phép tối đa ${model.maxReferences} ảnh tham chiếu. Tác vụ chưa được gửi.`), { code: "MEDIA_TASK_FAILED" });
  }
  if (model.ready !== true) {
    throw Object.assign(new Error("Mô-đun ảnh mac2API chưa sẵn sàng. Hãy kiểm tra tài khoản Muse. Tác vụ chưa được gửi."), { code: "MEDIA_TASK_FAILED" });
  }
  return "mac2api";
}

async function readBytes(response: Response, limit: number) {
  if (!response.body || Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new Error("Tệp Muse2API rỗng hoặc vượt giới hạn dung lượng.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new Error("Tệp Muse2API vượt giới hạn dung lượng.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!length) throw new Error("Muse2API trả về tệp rỗng.");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function references(context: MuseContext, inputs: MediaInput[], limit: number, maxTotalMiB = 24) {
  if (inputs.length > limit) {
    throw Object.assign(new Error(`Chọn tối đa ${limit} ảnh tham chiếu. Tác vụ chưa được gửi.`), { code: "MEDIA_TASK_FAILED" });
  }
  const result: string[] = [];
  let total = 0;
  for (const input of inputs) {
    let bytes: Uint8Array;
    let mimeType: string;
    if (input.type === "url") {
      const response = await context.tool.fetch(input.url, { signal: requestSignal(context) });
      if (!response.ok) throw new Error(`Không đọc được ảnh tham chiếu: HTTP ${response.status}`);
      mimeType = input.mimeType || response.headers.get("content-type")?.split(";")[0] || "";
      bytes = await readBytes(response, 10 * 1024 * 1024);
    } else {
      mimeType = input.mimeType;
      bytes = input.type === "binary" ? input.data : Buffer.from(input.data.replace(/^data:[^,]*,/, ""), "base64");
    }
    if (!/^image\/(png|jpeg|gif|webp)$/i.test(mimeType) || !bytes.length || bytes.byteLength > 10 * 1024 * 1024) {
      throw new Error("Ảnh tham chiếu phải là PNG/JPEG/GIF/WebP, tối đa 10 MiB mỗi ảnh.");
    }
    total += bytes.byteLength;
    if (total > maxTotalMiB * 1024 * 1024) {
      throw Object.assign(new Error(`Tổng ảnh tham chiếu Muse2API không được vượt ${maxTotalMiB} MiB. Tác vụ chưa được gửi.`),
        { code: "MEDIA_TASK_FAILED" });
    }
    result.push(`data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`);
  }
  return result;
}

function wait(context: MuseContext) {
  context.signal?.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(context.signal?.reason); };
    const timer = setTimeout(() => { context.signal?.removeEventListener("abort", abort); resolve(); }, 5000);
    context.signal?.addEventListener("abort", abort, { once: true });
  });
}

async function resultMedia(context: MuseContext, kind: MuseKind, data: Record<string, any>, protocol?: MuseProtocol): Promise<MediaAsset[]> {
  const task = data.task ?? data;
  const result = task.result ?? {};
  const item = Array.isArray(result.data) ? result.data[0] : Array.isArray(data.data) ? data.data[0] : undefined;
  let name = result.filename;
  if (typeof name !== "string") {
    const address = item?.url ?? task.url ?? result.url;
    if (typeof address !== "string") throw new Error("Muse2API báo thành công nhưng không có tệp kết quả.");
    const url = new URL(address, `${connection(context).baseUrl}/`);
    const match = url.pathname.match(/\/v1\/media\/([^/]+)$/);
    if (!match || url.search || url.hash) throw new Error("Đường dẫn tệp kết quả Muse2API không hợp lệ.");
    name = decodeURIComponent(match[1]!);
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name) || name.includes("..")) throw new Error("Tên tệp Muse2API không hợp lệ.");
  const { baseUrl, headers } = connection(context);
  // Chỉ tải từ dịch vụ đã cấu hình; không gửi Bearer sang URL do kết quả cung cấp.
  const mediaBase = protocol === "mac2api" ? baseUrl.replace(/\/muse\/v1$/, "/v1") : baseUrl;
  const response = await context.tool.fetch(`${mediaBase}/media/${encodeURIComponent(name)}`, {
    headers, signal: requestSignal(context, 120000), redirect: "error",
  });
  if (!response.ok) throw new Error(context.tool.errorMessage(await response.json().catch(() => null)) || `Tải kết quả Muse2API: HTTP ${response.status}`);
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
  if (!mimeType.startsWith(`${kind}/`)) { await response.body?.cancel(); throw new Error("Muse2API trả về sai loại tệp kết quả."); }
  return [{ type: "binary", data: await readBytes(response, 100 * 1024 * 1024), mimeType, name, mediaType: kind }];
}

async function pollTask(context: MuseContext, task: MuseTask): Promise<MediaAsset[]> {
  const path = task.kind === "image"
    ? (task.protocol === "python04" ? "/images/generations/" : "/images/tasks/")
    : "/videos/";
  const deadline = Date.now() + 65 * 60 * 1000;
  while (Date.now() < deadline) {
    context.signal?.throwIfAborted();
    const data = await jsonRequest(context, `${path}${encodeURIComponent(task.taskId!)}`);
    const status = String(data.status ?? data.task?.status ?? "").toLowerCase();
    if (["completed", "succeeded"].includes(status)) return resultMedia(context, task.kind, data, task.protocol);
    if (status === "interrupted" && task.protocol === "mac2api") {
      throw new Error(`Chưa rõ kết quả tác vụ ${task.taskId}. Hãy kiểm tra mục Tác vụ của mac2API.`);
    }
    if (["failed", "cancelled", "canceled"].includes(status)) {
      if (/cdp connection closed/i.test(String(data.error?.message ?? ""))) {
        throw Object.assign(new Error(`Muse2API mất kết nối CDP khi xử lý tác vụ ${task.taskId}. Tác vụ trên Muse2API đã thất bại; hãy khôi phục Chrome/driver của Muse2API rồi kiểm tra trạng thái trước khi chủ động gửi tác vụ mới.`), { code: "MEDIA_TASK_FAILED" });
      }
      throw Object.assign(new Error(context.tool.errorMessage(data) || `Muse2API: tác vụ ${status}.`), { code: "MEDIA_TASK_FAILED" });
    }
    if (!["queued", "running", "processing"].includes(status)) {
      throw new Error(`Muse2API: tác vụ ${task.taskId} có trạng thái ${status || "không xác định"}. Hãy kiểm tra trong trang quản trị; không tự gửi lại.`);
    }
    await wait(context);
  }
  throw new Error(`Đã ngừng chờ Muse2API. Tác vụ ${task.taskId} vẫn được lưu để kiểm tra/tiếp tục; không gửi lại yêu cầu mới.`);
}

async function submitTask(context: MuseContext, task: MuseTask): Promise<MediaAsset[]> {
  const imagePath = task.protocol === "python04" ? "/images/generations" : "/images/tasks";
  let data;
  try {
    data = await jsonRequest(context, task.kind === "image" ? imagePath : "/videos", task.payload!, task.idempotencyKey);
  } catch (cause) {
    if (task.protocol === "mac2api" && (cause as { status?: unknown })?.status === 429) {
      throw Object.assign(cause as Error, { code: "MEDIA_TASK_FAILED" });
    }
    throw cause;
  }
  return followReceipt(context, task, data);
}

async function followReceipt(context: MuseContext, task: MuseTask, data: Record<string, any>): Promise<MediaAsset[]> {
  const taskId = data.task_id ?? data.id;
  if (typeof taskId !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(taskId)) throw new Error("Muse2API chưa trả mã tác vụ hợp lệ; hãy kiểm tra trang quản trị trước khi gửi lại.");
  const saved: MuseTask = { transport: "muse2Api", kind: task.kind, serviceUrl: task.serviceUrl, idempotencyKey: task.idempotencyKey, protocol: task.protocol, taskId };
  await context.saveTaskData?.(saved);
  return pollTask(context, saved);
}

async function generate(context: MuseContext, kind: MuseKind, payload: ProviderTaskData, detectedProtocol?: MuseProtocol) {
  context.signal?.throwIfAborted();
  // Không submit khi driver đã mất CDP. Kiểm tra này không bảo đảm driver sẽ
  // luôn ổn trong lúc tạo; tác vụ đã submit vẫn chỉ được theo dõi theo ID cũ.
  const protocol = detectedProtocol ?? await assertServiceReady(context);
  let requestPayload = payload;
  if (protocol === "python04") {
    const images = Array.isArray(payload.images) ? payload.images as string[] : [];
    if (kind === "image") {
      // Python 0.4.0 reads 'image' (not 'images'), and uses 'async':true.
      // The existing adapter's 'aspect_ratio' field is silently ignored.
      requestPayload = {
        model: payload.model, prompt: payload.prompt, n: 1, response_format: "url",
        size: payload.aspect_ratio || payload.size || "1:1",
        image: images, async: true,
      };
    } else {
      // Python 0.4.0 currently accepts only a first frame. Never silently
      // discard the remaining ordered references.
      if (images.length > 1) throw new Error(
        "Muse2API Python 0.4.0 chỉ nhận một ảnh tham chiếu cho video. Các ảnh khác chưa được gửi; hãy giữ một ảnh hoặc dùng bản Muse2API hỗ trợ nhiều ảnh."
      );
      requestPayload = {
        model: payload.model, prompt: payload.prompt,
        duration: payload.duration, size: payload.aspect_ratio || payload.resolution || "16:9",
        ...(images[0] ? { image: images[0] } : {}),
      };
    }
  } else if (protocol === "python04alias") {
    const images = Array.isArray(payload.images) ? payload.images as string[] : [];
    if (kind === "image") {
      requestPayload = {
        ...payload, size: payload.aspect_ratio || payload.size || "1:1",
        image: images, async: true,
      };
    } else if (images.length > 1) {
      throw new Error(
        "Muse2API Python hiện chỉ xác nhận một ảnh đầu cho video; các ảnh tham chiếu còn lại chưa được gửi."
      );
    } else {
      requestPayload = {
        model: payload.model, prompt: payload.prompt, duration: payload.duration,
        size: payload.aspect_ratio || payload.resolution || "16:9",
        ...(images[0] ? { image: images[0] } : {}),
      };
    }
  }
  const duration = requestPayload.duration;
  if (kind === "video" && typeof duration === "number" && (protocol === "vip0014" || duration > 60)) {
    // ACT: Go ignores duration when building the prompt and rejects values over 10.
    // Python 0.4 accepts the field through 60. Beyond the API range, keep the request in the prompt.
    requestPayload = {
      ...requestPayload,
      prompt: `${requestPayload.prompt}\n\nThời lượng mong muốn là ${duration} giây. Nếu chỉ có các thời lượng cố định, hãy tạo và đính kèm clip gần nhất.`,
    };
    if (duration > (protocol === "vip0014" ? 10 : 60)) delete requestPayload.duration;
  }
  const task: MuseTask = {
    transport: "muse2Api", kind, serviceUrl: connection(context).baseUrl,
    protocol,
    idempotencyKey: `macflow.${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}.${Math.random().toString(36).slice(2)}`,
    payload: JSON.parse(JSON.stringify(requestPayload)),
  };
  // Lưu trước POST: thao tác Tiếp tục dùng đúng snapshot và Idempotency-Key cũ.
  await context.saveTaskData?.(task);
  return submitTask(context, task);
}

export default {
  id: "muse2Api",
  label: "Muse2API (Python / Go)",
  icon: "",
  version: "1.0.2",
  readme: "Tạo ảnh với tối đa 20 ảnh tham chiếu khi kết nối mac2API đã cập nhật bằng khóa người dùng m2c_. Tự nhận diện Muse2API Python 0.4.0 hoặc Go vip0014 cho quy trình cũ. Python 0.4.0: ảnh nhận tối đa 4 ảnh qua trường image, video nhận một ảnh đầu. Thời lượng video là mục tiêu gửi đến Muse. Không tự gửi lại yêu cầu Python nếu mất task ID.",
  rules,
  models: [
    { id: "muse-image", label: "Muse Image", type: "image", mode: ["text", "singleImage", "multiReference"], imageSizes: ["auto"], imageRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] },
    {
      id: "muse-video", label: "Muse Video (720p)", type: "video", mode: ["text", "singleImage", ["imageReference:4"]], audio: true,
      rules: [{
        type: "input", field: "museVideoDuration", title: "Thời lượng mong muốn (giây)", value: "", required: false,
        props: { type: "number", min: 1, step: 1, placeholder: "Theo mô tả hoặc mặc định của Muse" },
      }],
    },
  ] satisfies ProviderModel[],
  async generateImage(request: ImageRequest): Promise<MediaAsset[]> {
    if (request.model !== "muse-image") throw new Error("Model ảnh Muse2API phải là muse-image.");
    if (request.n !== undefined && request.n !== 1) throw new Error("Muse2API chỉ tạo một ảnh mỗi tác vụ.");
    if (request.mask) throw new Error("Muse2API chưa hỗ trợ mask; hãy dùng chỉnh sửa bằng ảnh tham chiếu và prompt.");
    if (!request.prompt.trim()) throw new Error("Hãy nhập prompt tạo ảnh.");
    if (request.quality || request.outputFormat) throw new Error("Muse2API không hỗ trợ tham số quality/outputFormat.");
    const images = request.images ?? [];
    const protocol = await imageProtocol(this, images.length);
    return generate(this, "image", {
      model: request.model, prompt: request.prompt, n: 1, response_format: "url",
      size: request.size ?? "auto", aspect_ratio: request.ratio ?? "",
      images: protocol === "mac2api"
        ? await references(this, images, maxImageReferences, 100)
        : await references(this, images, maxLegacyReferences),
    }, protocol);
  },
  async generateVideo(request: VideoRequest): Promise<MediaAsset[]> {
    if (request.model !== "muse-video") throw new Error("Model video Muse2API phải là muse-video.");
    if (!request.prompt.trim()) throw new Error("Hãy nhập prompt tạo video.");
    if (request.lastFrame || request.videos?.length || request.audios?.length) throw new Error("Muse2API chỉ nhận ảnh tham chiếu; chưa hỗ trợ khung cuối/video/audio đầu vào.");
    const override = request.other?.museVideoDuration;
    const value = typeof override === "string" ? override.trim() : override;
    const duration = value == null || value === "" ? request.duration ?? undefined
      : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
    if (duration !== undefined && (typeof duration !== "number" || !Number.isSafeInteger(duration) || duration < 1)) {
      throw Object.assign(new Error("Thời lượng video phải là số nguyên dương (giây). Tác vụ chưa được gửi."), { code: "MEDIA_TASK_FAILED" });
    }
    if (request.generateAudio === false || request.watermark !== undefined) throw new Error("Muse2API không có công tắc âm thanh/watermark.");
    const prompt = request.prompt.replace(/\{\{ref (\d+)\}\}/g, (marker, number: string) => {
      const order = (request as VideoRequest & { referenceOrder?: ({ type: string; index?: number })[] }).referenceOrder;
      if (!order) return marker;
      const ref = order[Number(number) - 1];
      if (ref?.type === "text") return `tham chiếu ${number}`;
      if (ref?.type === "firstFrame" && request.firstFrame) return "ảnh tham chiếu 1";
      if (ref?.type !== "image" || !Number.isInteger(ref.index) || !request.images?.[ref.index!]) throw new Error(`Thiếu ánh xạ ảnh cho ${marker}.`);
      return `ảnh tham chiếu ${ref.index! + 1 + (request.firstFrame ? 1 : 0)}`;
    });
    return generate(this, "video", {
      model: request.model, prompt, ...(duration !== undefined ? { duration } : {}),
      aspect_ratio: request.ratio ?? "", resolution: request.resolution ?? "720p",
      images: await references(this, [...(request.firstFrame ? [request.firstFrame] : []), ...(request.images ?? [])], maxLegacyReferences),
    });
  },
  async resumeTask(data: ProviderTaskData): Promise<MediaAsset[]> {
    if (data.transport !== "muse2Api" || !["image", "video"].includes(String(data.kind)) || data.serviceUrl !== connection(this).baseUrl
      || typeof data.idempotencyKey !== "string" || !/^macflow\.[a-z0-9.]{1,180}$/.test(data.idempotencyKey)) {
      throw new Error("Không thể tiếp tục: cấu hình dịch vụ Muse2API hoặc dữ liệu tác vụ đã thay đổi.");
    }
    const task = data as MuseTask;
    if (typeof task.taskId === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(task.taskId)) return pollTask(this, task);
    if (task.protocol === "mac2api") {
      const receipt = await jsonRequest(this, "/tasks/by-request", undefined, task.idempotencyKey);
      return followReceipt(this, task, receipt);
    }
    if (task.protocol === "python04" || task.protocol === "python04alias") throw new Error(
      "Muse2API Python không xác nhận Idempotency-Key. Chưa có task ID: hãy kiểm tra /admin/tasks trên đúng dịch vụ trước khi tạo tác vụ mới; không tự gửi lại."
    );
    if (task.payload && typeof task.payload === "object" && !Array.isArray(task.payload)) return submitTask(this, task);
    throw new Error("Tác vụ Muse2API thiếu mã và snapshot yêu cầu; hãy kiểm tra trang quản trị.");
  },
} satisfies ProviderDefinition<typeof rules>;
