const rules = [
  {
    type: "input",
    field: "baseUrl" as const,
    title: "Địa chỉ Gemini Web To API",
    value: "http://127.0.0.1:4981/openai/v1",
    props: { placeholder: "http://127.0.0.1:4981/openai/v1" },
  },
  {
    type: "input",
    field: "apiKey" as const,
    title: "Khóa tương thích OpenAI (không phải Google API Key)",
    value: "not-needed",
    props: { type: "password", showPassword: true, autocomplete: "off" },
  },
] as const;

type Context = ProviderContext<ProviderConfig<typeof rules>>;
type VideoTask = { kind: "geminiWebVideo"; baseUrl: string; taskId?: string };

function connection(context: Context) {
  let address: URL;
  try { address = new URL(context.config.baseUrl.trim()); }
  catch { throw new Error("Địa chỉ Gemini Web To API không hợp lệ."); }
  if (address.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(address.hostname)
    || address.port !== "4981" || address.pathname.replace(/\/+$/, "") !== "/openai/v1"
    || address.username || address.password || address.search || address.hash) {
    throw new Error("Gemini Web To API chỉ được kết nối cục bộ qua http://127.0.0.1:4981/openai/v1 (hoặc localhost). Tác vụ chưa được gửi.");
  }
  return {
    baseUrl: `http://${address.hostname}:4981/openai/v1`,
    headers: { Authorization: `Bearer ${context.config.apiKey.trim() || "not-needed"}` },
  };
}

function requestSignal(context: Context, timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return context.signal ? AbortSignal.any([context.signal, timeout]) : timeout;
}

async function readBytes(response: Response, limit: number): Promise<Uint8Array> {
  const lengthHeader = response.headers.get("content-length");
  if (!response.body || (lengthHeader && Number(lengthHeader) > limit)) {
    await response.body?.cancel();
    throw new Error("Phản hồi Gemini Web To API rỗng hoặc vượt giới hạn dung lượng.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Phản hồi Gemini Web To API vượt giới hạn dung lượng.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!size) throw new Error("Gemini Web To API trả về dữ liệu rỗng.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function readJson(response: Response, maxBytes = 1024 * 1024): Promise<Record<string, any>> {
  const bytes = await readBytes(response, maxBytes);
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, any>;
  } catch { /* Phản hồi bị lỗi định dạng. */ }
  throw new Error("Gemini Web To API trả về JSON không hợp lệ.");
}

async function getModels(context: Context) {
  const { baseUrl, headers } = connection(context);
  let response: Response;
  try {
    response = await context.tool.fetch(`${baseUrl}/models`, {
      headers, signal: requestSignal(context, 8000), redirect: "error",
    });
  } catch (error) {
    context.signal?.throwIfAborted();
    throw new Error("Không kiểm tra được các mô hình của Gemini Web To API. Chưa gửi yêu cầu tạo.", { cause: error });
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Không lấy được danh sách mô hình Gemini Web (HTTP ${response.status}). Chưa gửi yêu cầu tạo.`);
  }
  const data = await readJson(response);
  if (!Array.isArray(data.data) || !data.data.length) throw new Error("Gemini Web chưa cung cấp mô hình nào cho tài khoản này. Chưa gửi yêu cầu tạo.");
  return data.data.filter((item: unknown): item is { id: string } => !!item && typeof item === "object"
    && typeof (item as { id?: unknown }).id === "string" && !!(item as { id: string }).id.trim()).map((item: { id: string }) => item.id);
}

async function post(context: Context, path: string, body: Record<string, unknown>, timeoutMs: number) {
  const { baseUrl, headers } = connection(context);
  let response: Response;
  try {
    response = await context.tool.fetch(`${baseUrl}${path}`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: requestSignal(context, timeoutMs), redirect: "error",
    });
  } catch (error) {
    context.signal?.throwIfAborted();
    throw new Error("Chưa xác định được Gemini Web có nhận yêu cầu hay chưa. Hãy kiểm tra dịch vụ trước khi chủ động tạo tác vụ mới; không tự gửi lại.", { cause: error });
  }
  const data = await readJson(response, path === "/images/generations" ? 48 * 1024 * 1024 : 1024 * 1024);
  if (!response.ok) throw new Error(context.tool.errorMessage(data) || `Gemini Web To API: HTTP ${response.status}`);
  return data;
}

function imageMime(bytes: Uint8Array): string {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 6 && Buffer.from(bytes.subarray(0, 6)).toString("ascii").match(/^GIF8[79]a$/)) return "image/gif";
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF"
    && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP") return "image/webp";
  throw new Error("Gemini Web To API trả về dữ liệu không phải ảnh PNG/JPEG/GIF/WebP.");
}

function imageAsset(data: Record<string, any>): MediaAsset[] {
  if (!Array.isArray(data.data) || data.data.length !== 1) {
    throw new Error("Gemini Web chưa trả về đúng một ảnh; hãy kiểm tra kết quả trong Gemini Web trước khi tạo lại.");
  }
  const encoded = data.data[0]?.b64_json;
  if (typeof encoded !== "string" || encoded.length > 40 * 1024 * 1024 || !encoded.length
    || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("Gemini Web To API không trả về ảnh base64 hợp lệ.");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > 30 * 1024 * 1024) throw new Error("Ảnh Gemini Web rỗng hoặc vượt 30 MiB.");
  return [{ type: "binary", mediaType: "image", data: bytes, mimeType: imageMime(bytes) }];
}

async function videoResult(context: Context, task: VideoTask): Promise<MediaAsset[]> {
  const { baseUrl, headers } = connection(context);
  const deadline = Date.now() + 15 * 60_000;
  const taskUrl = `${baseUrl}/videos/${encodeURIComponent(task.taskId!)}`;
  while (Date.now() < deadline) {
    context.signal?.throwIfAborted();
    const response = await context.tool.fetch(taskUrl, { headers, signal: requestSignal(context, 15000), redirect: "error" });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Không kiểm tra được video Gemini Web ${task.taskId} (HTTP ${response.status}). Không gửi lại yêu cầu tạo.`);
    }
    const data = await readJson(response);
    if (data.id !== task.taskId) throw new Error("Mã video Gemini Web không khớp với tác vụ đang theo dõi.");
    if (data.status === "completed") {
      const content = await context.tool.fetch(`${taskUrl}/content`, {
        headers, signal: requestSignal(context, 120000), redirect: "error",
      });
      if (!content.ok) {
        await content.body?.cancel();
        throw new Error(`Không tải được video Gemini Web ${task.taskId} (HTTP ${content.status}). Có thể thử tiếp tục cùng mã tác vụ.`);
      }
      const bytes = await readBytes(content, 100 * 1024 * 1024);
      if (bytes.length < 12 || Buffer.from(bytes.subarray(4, 8)).toString("ascii") !== "ftyp") {
        throw new Error("Dịch vụ trả về dữ liệu không phải video MP4 hợp lệ.");
      }
      return [{ type: "binary", data: bytes, mimeType: "video/mp4", mediaType: "video" }];
    }
    if (["failed", "cancelled", "canceled"].includes(String(data.status))) {
      throw Object.assign(new Error(`Video Gemini Web ${task.taskId} đã thất bại (${data.status}).`), { code: "MEDIA_TASK_FAILED" });
    }
    if (!["queued", "in_progress", "processing"].includes(String(data.status))) {
      throw new Error(`Trạng thái video Gemini Web không xác định: ${String(data.status)}. Hãy kiểm tra tác vụ ${task.taskId}.`);
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { context.signal?.removeEventListener("abort", abort); resolve(); }, 10000);
      const abort = () => { clearTimeout(timer); reject(context.signal?.reason); };
      context.signal?.addEventListener("abort", abort, { once: true });
    });
  }
  throw new Error(`Đã ngừng chờ video Gemini Web ${task.taskId}; hãy tiếp tục kiểm tra cùng mã tác vụ, không tạo lại.`);
}

export default {
  id: "geminiWebToApi",
  label: "Gemini Web To API (ảnh/video cục bộ)",
  icon: "",
  version: "1.0.0",
  readme: "Kết nối ntthanh2603/gemini-web-to-api tại 127.0.0.1:4981. Dịch vụ phải chạy và đã đăng nhập Gemini Web; trường khóa chỉ tương thích OpenAI SDK, không phải Google API Key. Xem GET /openai/v1/models để biết ID của tài khoản: gemini-auto thường có sẵn, các ID khác chỉ dùng khi dịch vụ thực sự trả về. Ảnh: một ảnh mỗi lần, size 1024x1024 chỉ là yêu cầu gợi ý, Gemini có thể không giữ đúng kích thước; endpoint ảnh chưa nhận ảnh tham chiếu. Video: bí danh sora-2 dùng công cụ Videos của Gemini, 16:9/9:16, khoảng 10 giây, có âm thanh; tài khoản phải có quyền tạo video. Video không hỗ trợ ảnh tham chiếu hoặc điều chỉnh thời lượng/chất lượng. Tác vụ đã gửi không tự gửi lại khi mất kết nối.",
  rules,
  models: [
    { id: "gemini-auto", label: "Gemini Web Auto (tạo ảnh)", type: "image", mode: ["text"], imageSizes: ["1024x1024"], imageRatios: ["1:1"] },
    { id: "sora-2", label: "Gemini Web Videos (bí danh SDK)", type: "video", mode: ["text"], audio: true, imageRatios: ["16:9", "9:16"], durationResolutionMap: [{ duration: [10], resolution: ["720p"] }] },
  ] satisfies ProviderModel[],
  async generateImage(request: ImageRequest): Promise<MediaAsset[]> {
    this.signal?.throwIfAborted();
    if (!request.prompt?.trim()) throw new Error("Hãy nhập prompt để tạo ảnh Gemini Web.");
    if (request.images?.length || request.mask) throw new Error("Endpoint /images/generations chưa hỗ trợ ảnh tham chiếu hoặc mask. Chưa gửi tác vụ để tránh mất ảnh tham chiếu.");
    if (request.n !== undefined && request.n !== 1) throw new Error("Gemini Web To API chỉ tạo một ảnh mỗi yêu cầu.");
    if (request.quality || request.outputFormat) throw new Error("Gemini Web To API chưa hỗ trợ cài đặt quality hoặc outputFormat.");
    if (request.ratio && request.ratio !== "1:1") throw new Error("Endpoint ảnh Gemini Web chưa xác nhận hỗ trợ chọn tỉ lệ này; chưa gửi tác vụ.");
    if (request.size && !["auto", "1024x1024"].includes(request.size)) throw new Error("Gemini Web To API chưa xác nhận kích thước ảnh được chọn; chỉ chấp nhận 1024x1024 (gợi ý).");
    const models = await getModels(this);
    if (!models.includes(request.model)) throw new Error(`Model ${request.model} không có trong danh sách tài khoản Gemini Web; hãy kiểm tra /openai/v1/models.`);
    await this.saveTaskData?.({ kind: "geminiWebImage", baseUrl: connection(this).baseUrl });
    const data = await post(this, "/images/generations", {
      model: request.model, prompt: request.prompt, size: "1024x1024", n: 1, response_format: "b64_json",
    }, 360000);
    return imageAsset(data);
  },
  async generateVideo(request: VideoRequest): Promise<MediaAsset[]> {
    this.signal?.throwIfAborted();
    if (!request.prompt?.trim() || Buffer.byteLength(request.prompt, "utf8") > 8000) throw new Error("Prompt video phải có nội dung và tối đa 8000 byte.");
    if (request.firstFrame || request.lastFrame || request.images?.length || request.videos?.length || request.audios?.length) {
      throw new Error("Video Gemini Web hiện chỉ hỗ trợ văn bản, không nhận ảnh, khung hình, video hoặc âm thanh tham chiếu.");
    }
    if (request.duration !== undefined && request.duration !== 10) throw new Error("Gemini Web tạo video khoảng 10 giây, không có điều chỉnh thời lượng.");
    if (request.resolution && request.resolution !== "720p") throw new Error("Video Gemini Web hiện chỉ có 720p.");
    if (request.generateAudio === false || request.watermark !== undefined) throw new Error("Gemini Web chưa hỗ trợ điều chỉnh âm thanh hoặc watermark.");
    if (request.ratio && !["16:9", "9:16"].includes(request.ratio)) throw new Error("Video Gemini Web chỉ hỗ trợ tỉ lệ 16:9 hoặc 9:16.");
    const models = await getModels(this);
    if (request.model !== "sora-2" && !models.includes(request.model)) throw new Error(`Model ${request.model} không có trong tài khoản Gemini Web.`);
    const task: VideoTask = { kind: "geminiWebVideo", baseUrl: connection(this).baseUrl };
    await this.saveTaskData?.(task);
    const ratio = request.ratio || "16:9";
    const data = await post(this, "/videos", {
      model: request.model, prompt: request.prompt, size: ratio === "9:16" ? "720x1280" : "1280x720",
    }, 60000);
    if (typeof data.id !== "string" || !/^video_[A-Za-z0-9_-]{1,180}$/.test(data.id)) {
      throw new Error("Gemini Web chưa trả mã video hợp lệ. Kiểm tra danh sách tác vụ trong dịch vụ trước khi gửi lại.");
    }
    const accepted: VideoTask = { ...task, taskId: data.id };
    await this.saveTaskData?.(accepted);
    return videoResult(this, accepted);
  },
  async resumeTask(data: ProviderTaskData): Promise<MediaAsset[]> {
    if (data.baseUrl !== connection(this).baseUrl) throw new Error("Địa chỉ Gemini Web To API đã thay đổi, không thể kiểm tra tác vụ cũ.");
    if (data.kind === "geminiWebVideo" && typeof data.taskId === "string" && /^video_[A-Za-z0-9_-]{1,180}$/.test(data.taskId)) {
      return videoResult(this, data as VideoTask);
    }
    throw new Error("Yêu cầu Gemini Web trước đó chưa có mã tác vụ để khôi phục. Hãy kiểm tra lịch sử Gemini Web hoặc dịch vụ, tránh gửi trùng.");
  },
} satisfies ProviderDefinition<typeof rules>;
