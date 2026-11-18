// Toonflow media provider source. This file is imported through Settings →
// Multimedia models → Add custom provider; no extensions or imports needed.
const rules = [
  { type: "input", field: "baseUrl" as const, title: "AI-Bridge API Base URL (chỉ máy này)",
    value: "http://127.0.0.1:4319/v1", props: { placeholder: "http://127.0.0.1:4319/v1" } },
  { type: "input", field: "apiKey" as const, title: "API Key của AI-Bridge tùy chỉnh",
    value: "", props: { type: "password", showPassword: true, autocomplete: "off" } },
] as const;

type Context = ProviderContext<ProviderConfig<typeof rules>>;
type Kind = "image" | "video";
type Target = { profileInstanceId: string; tabId: number; documentToken: string; url: string };
type InputImage = { id: string; mime_type: string; size: number; sha256: string };
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hosts: Record<string, string[]> = {
  muse: ["muse.ai", "www.muse.ai"], chatgpt: ["chatgpt.com"],
  gemini: ["gemini.google.com"], claude: ["claude.ai"], grok: ["grok.com"],
  deepseek: ["chat.deepseek.com"], perplexity: ["www.perplexity.ai"],
  qwen: ["chat.qwen.ai", "chat.qwenlm.ai"], kimi: ["www.kimi.com"], zai: ["chat.z.ai"],
};
const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
const validImages = ["image/png", "image/jpeg", "image/webp"];
const validVideos = ["video/mp4", "video/webm"];

// SHA-256 in pure JavaScript: the provider VM intentionally exposes no
// crypto/Node imports. Bun.hash is NOT a cryptographic checksum.
function sha256(bytes: Uint8Array): string {
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bits = bytes.length * 8;
  const n = padded.length;
  padded[n - 8] = Math.floor(bits / 2 ** 56) & 255;
  padded[n - 7] = Math.floor(bits / 2 ** 48) & 255;
  padded[n - 6] = Math.floor(bits / 2 ** 40) & 255;
  padded[n - 5] = Math.floor(bits / 2 ** 32) & 255;
  padded[n - 4] = (bits >>> 24) & 255;
  padded[n - 3] = (bits >>> 16) & 255;
  padded[n - 2] = (bits >>> 8) & 255;
  padded[n - 1] = bits & 255;
  const W = new Uint32Array(64);
  const rr = (v: number, s: number) => (v >>> s) | (v << (32 - s));
  for (let p = 0; p < n; p += 64) {
    for (let i = 0; i < 16; i++) {
      const k = p + i * 4;
      W[i] = (padded[k]! << 24) | (padded[k + 1]! << 16) | (padded[k + 2]! << 8) | padded[k + 3]!;
    }
    for (let i = 16; i < 64; i++) {
      const x = W[i - 15]!, y = W[i - 2]!;
      W[i] = (W[i - 16]! + (rr(x,7) ^ rr(x,18) ^ (x >>> 3)) + W[i - 7]!
        + (rr(y,17) ^ rr(y,19) ^ (y >>> 10))) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let i = 0; i < 64; i++) {
      const s1 = rr(e!,6) ^ rr(e!,11) ^ rr(e!,25);
      const ch = (e! & f!) ^ (~e! & g!);
      const t1 = (h! + s1 + ch + K[i]! + W[i]!) >>> 0;
      const s0 = rr(a!,2) ^ rr(a!,13) ^ rr(a!,22);
      const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (s0 + maj) >>> 0;
      h=g; g=f; f=e; e=(d!+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    for (const [i, v] of [a,b,c,d,e,f,g,h].entries()) H[i] = (H[i]! + v!) >>> 0;
  }
  return H.map(x => x.toString(16).padStart(8, "0")).join("");
}

function signature(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/png") return bytes.length >= 45 && pngHeader.every((v,i) => bytes[i] === v);
  if (mime === "image/jpeg") return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/webp") return bytes.length >= 20 && String.fromCharCode(...bytes.subarray(0,4)) === "RIFF"
    && String.fromCharCode(...bytes.subarray(8,12)) === "WEBP";
  if (mime === "video/mp4") return bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4,8)) === "ftyp";
  if (mime === "video/webm") return bytes.length >= 12 && bytes[0] === 26 && bytes[1] === 69
    && bytes[2] === 223 && bytes[3] === 163;
  return false;
}
function connection(context: Context) {
  let url: URL;
  try { url = new URL(context.config.baseUrl.trim()); }
  catch { throw new Error("URL AI-Bridge không hợp lệ."); }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)
    || url.port !== "4319" || url.pathname.replace(/\/+$/, "") !== "/v1"
    || url.username || url.password || url.search || url.hash)
    throw new Error("Adapter này chỉ kết nối bản tùy chỉnh http://127.0.0.1:4319/v1, không kết nối AI-Bridge-Original.");
  const key = context.config.apiKey.trim();
  if (key.length < 24 || /\s/.test(key)) throw new Error("Cần cấu hình đúng API Key của AI-Bridge, không phải Bridge Token.");
  return { base: url.href.replace(/\/+$/, ""), headers: { Authorization: `Bearer ${key}` } };
}
function signalFor(context: Context, ms: number) {
  return context.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
}
async function bytesOf(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    await response.body?.cancel();
    throw new Error("AI-Bridge trả dữ liệu vượt dung lượng hoặc Content-Length không hợp lệ.");
  }
  if (!response.body) throw new Error("AI-Bridge trả nội dung rỗng.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) throw new Error("Dữ liệu AI-Bridge vượt dung lượng giới hạn.");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!total || (declared && Number(declared) !== total)) throw new Error("AI-Bridge trả dữ liệu bị thiếu.");
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
async function jsonOf(response: Response) {
  const data = await bytesOf(response, 1_000_000);
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  } catch { /* Fail closed. */ }
  throw new Error("AI-Bridge trả JSON không hợp lệ.");
}
async function get(context: Context, path: string) {
  const { base, headers } = connection(context);
  let response: Response;
  try {
    response = await context.tool.fetch(`${base.slice(0, -3)}${path}`, {
      headers, signal: signalFor(context, 8000), redirect: "error",
    });
  } catch {
    context.signal?.throwIfAborted();
    throw new Error("Không đọc được trạng thái AI-Bridge cục bộ; chưa gửi prompt.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`AI-Bridge không xác thực hoặc chưa sẵn sàng (HTTP ${response.status}).`);
  }
  return jsonOf(response);
}
function pinned(raw: unknown): Target {
  let target: unknown;
  try { target = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { throw new Error("Định danh tab AI-Bridge không hợp lệ; hãy chọn lại tab."); }
  if (Array.isArray(target) && target.length === 4)
    target = { profileInstanceId: target[0], tabId: target[1], documentToken: target[2], url: target[3] };
  if (!target || typeof target !== "object") throw new Error("Hãy chọn đúng AI, Chrome Profile và tab ngay trong node MacFlow.");
  const t = target as Partial<Target>;
  if (!uuidPattern.test(t.profileInstanceId ?? "") || !Number.isSafeInteger(t.tabId) || (t.tabId ?? -1) < 0
    || !uuidPattern.test(t.documentToken ?? "") || typeof t.url !== "string")
    throw new Error("Định danh Profile/tab/phiên trang AI-Bridge không hợp lệ.");
  return { profileInstanceId: t.profileInstanceId!, tabId: t.tabId!,
    documentToken: t.documentToken!, url: t.url };
}
function selectTab(status: Record<string, any>, target: Target, kind: Kind) {
  if (!Number.isSafeInteger(status.connected_extensions) || status.connected_extensions < 1)
    throw new Error("Không có Chrome extension AI-Bridge đang kết nối; chưa gửi prompt.");
  const tab = Array.isArray(status.tabs) ? status.tabs.find((t: any) =>
    t?.profileInstanceId === target.profileInstanceId && t.tabId === target.tabId
    && t.documentToken === target.documentToken && t.url === target.url) : undefined;
  if (!tab || !tab.ready || tab.busy) throw new Error("Tab AI-Bridge đã F5, mất kết nối hoặc đang bận. Chưa gửi yêu cầu.");
  if (!Array.isArray(tab.outputKinds) || !tab.outputKinds.includes(kind))
    throw new Error(`Tab đã chọn chưa được xác minh hỗ trợ tạo ${kind === "image" ? "ảnh" : "video"}; chưa gửi prompt.`);
  const provider = String(tab.provider ?? "");
  let url: URL;
  try { url = new URL(target.url); } catch { throw new Error("URL tab AI không hợp lệ."); }
  if (url.protocol !== "https:" || url.username || url.password || !hosts[provider]?.includes(url.hostname))
    throw new Error("AI-Bridge không xác minh được provider/URL tab. Chưa gửi yêu cầu.");
  const versions = Array.isArray(status.extension_versions) ? status.extension_versions : [];
  if (!versions.some((v: unknown) => typeof v === "string" && /^(?:[1-9]\d*|0\.(?:[6-9]|[1-9]\d+))\.\d+$/.test(v)))
    throw new Error("Extension AI-Bridge cũ; cần nạp bản 0.6.0 trước khi gửi ảnh/video.");
  return provider;
}
async function upload(context: Context, input: MediaInput): Promise<InputImage> {
  if (input.type === "url") throw new Error("Không nhận URL ảnh tham chiếu. Hãy chuyển ảnh thành tệp trong workspace.");
  if (!validImages.includes(input.mimeType)) throw new Error("Ảnh tham chiếu phải là PNG/JPEG/WebP.");
  let image: Uint8Array;
  if (input.type === "binary") image = new Uint8Array(input.data);
  else {
    if (input.data.startsWith("data:") && !input.data.startsWith(`data:${input.mimeType};base64,`))
      throw new Error("MIME của ảnh data URL không khớp định dạng được khai báo.");
    const data = input.data.startsWith("data:") ? input.data.split(",", 2)[1] : input.data;
    if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 !== 0
      || data.length > Math.ceil(5 * 1024 * 1024 / 3) * 4)
      throw new Error("Base64 ảnh tham chiếu không hợp lệ hoặc vượt 5 MiB.");
    image = Buffer.from(data, "base64");
    if (Buffer.from(image).toString("base64") !== data) throw new Error("Base64 ảnh tham chiếu không chính xác.");
  }
  if (!image.length || image.length > 5 * 1024 * 1024 || !signature(image, input.mimeType))
    throw new Error("Ảnh tham chiếu sai MIME, chữ ký hoặc dung lượng.");
  const { base, headers } = connection(context);
  let response: Response;
  try {
    response = await context.tool.fetch(`${base}/input-images`, {
      method: "POST", headers: { ...headers, "Content-Type": input.mimeType }, body: image,
      signal: signalFor(context, 30000), redirect: "error",
    });
  } catch {
    context.signal?.throwIfAborted();
    throw new Error("Chưa xác nhận tải ảnh tham chiếu lên AI-Bridge. Chưa gửi prompt và không tự gửi lại.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Tải ảnh tham chiếu thất bại (HTTP ${response.status}). Chưa gửi prompt.`);
  }
  const uploaded = await jsonOf(response);
  if (response.status !== 201 || !uuidPattern.test(uploaded.id ?? "") || uploaded.mime_type !== input.mimeType
    || uploaded.size !== image.length || uploaded.sha256 !== sha256(image))
    throw new Error("AI-Bridge không xác nhận đúng nội dung ảnh đã tải lên. Chưa gửi prompt.");
  return { id: uploaded.id, mime_type: uploaded.mime_type, size: uploaded.size, sha256: uploaded.sha256 };
}
async function run(context: Context, kind: Kind, request: ImageRequest | VideoRequest): Promise<MediaAsset[]> {
  if (request.model !== kind) throw new Error("Mô hình và loại kết quả AI-Bridge không khớp.");
  if (typeof request.prompt !== "string" || !request.prompt.trim()) throw new Error("Hãy nhập prompt tạo ảnh/video.");
  if (request.other && Object.keys(request.other).some(field => field !== "bridgeTarget"))
    throw new Error("AI-Bridge chưa hỗ trợ các tùy chọn other ngoài bridgeTarget; chưa gửi prompt.");
  if ((request as ImageRequest).mask || (request as ImageRequest).n !== undefined && (request as ImageRequest).n !== 1
    || (request as ImageRequest).quality || (request as ImageRequest).outputFormat
    || (request as VideoRequest).videos?.length || (request as VideoRequest).audios?.length
    || (request as VideoRequest).watermark !== undefined || (request as VideoRequest).generateAudio === true)
    throw new Error("AI-Bridge chưa kiểm chứng tham số này; hãy tắt hoặc chọn nhà cung cấp khác.");
  const video = request as VideoRequest;
  if (kind === "video" && video.mode && video.mode !== "text" && video.mode !== "singleImage")
    throw new Error("AI-Bridge chưa xác minh chế độ khung đầu/cuối hoặc tham chiếu video.");
  const target = pinned(request.other?.bridgeTarget);
  const status = await get(context, "/api/bridge/status");
  const provider = selectTab(status, target, kind);
  const availableModels = await get(context, "/v1/models");
  if (!Array.isArray(availableModels.data) || !availableModels.data.some((m: any) => m?.id === `bridge-${provider}`))
    throw new Error("AI-Bridge chưa công bố AI đã chọn. Chưa gửi yêu cầu.");
  const references = [...(request.images ?? []), ...(video.firstFrame ? [video.firstFrame] : []),
    ...(video.lastFrame ? [video.lastFrame] : [])];
  if (references.length > 4) throw new Error("AI-Bridge chỉ hỗ trợ tối đa bốn ảnh tham chiếu.");
  if (references.length && provider === "muse")
    throw new Error("Muse chưa được xác minh upload ảnh tham chiếu; không gửi prompt thiếu ảnh.");
  if (kind === "video" && video.mode === "singleImage" && references.length !== 1)
    throw new Error("Chế độ tạo video từ ảnh cần đúng một ảnh tham chiếu.");
  if (kind === "video" && references.length && video.mode !== "singleImage")
    throw new Error("Ảnh tham chiếu video cần chế độ singleImage; không gửi thiếu thông số.");
  if (kind === "video" && video.mode === "text" && references.length)
    throw new Error("Chế độ tạo video từ chữ không được âm thầm bỏ qua ảnh tham chiếu.");
  // The bridge's adapter interprets extra settings as natural-language hints,
  // not guaranteed mode/quality controls. Explicit unsupported switches fail.
  const hints = [
    request.ratio ? `Tỷ lệ mong muốn: ${request.ratio}` : "",
    kind === "image" && (request as ImageRequest).size ? `Kích thước mong muốn: ${(request as ImageRequest).size}` : "",
    kind === "video" && video.resolution ? `Độ phân giải mong muốn: ${video.resolution}` : "",
    kind === "video" && video.duration ? `Thời lượng mong muốn: ${video.duration} giây` : "",
  ].filter(Boolean).join("; ");
  const prompt = request.prompt.trim() + (hints ? `\n\nGợi ý (không cam kết điều khiển): ${hints}.` : "");
  const uploaded: string[] = [];
  let size = 0;
  for (const ref of references) {
    const value = await upload(context, ref);
    size += value.size;
    if (size > 16 * 1024 * 1024) throw new Error("Tổng ảnh tham chiếu vượt 16 MiB; chưa gửi prompt.");
    uploaded.push(value.id);
  }
  // An upload may have finished while the Chrome tab navigated. Re-probe
  // identity immediately before submission. Never substitute another tab.
  const fresh = await get(context, "/api/bridge/status");
  const checkedProvider = selectTab(fresh, target, kind);
  if (checkedProvider !== provider) throw new Error("AI/tab đã thay đổi giữa lúc tải ảnh; chưa gửi prompt.");
  await context.saveTaskData?.({ transport: "aiBridgeLocal", stage: "submitting",
    provider, tabId: target.tabId, documentToken: target.documentToken });
  const { base, headers } = connection(context);
  let response: Response;
  try {
    response = await context.tool.fetch(`${base}/chat/completions`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, redirect: "error",
      signal: signalFor(context, 245000),
      body: JSON.stringify({ model: `bridge-${provider}`, target, media_kind: kind, stream: false,
        messages: [{ role: "user", content: prompt }], ...(uploaded.length ? { input_images: uploaded } : {}) }),
    });
  } catch {
    context.signal?.throwIfAborted();
    throw new Error("Chưa biết AI có nhận prompt hay chưa. Hãy kiểm tra đúng tab trước khi tạo tác vụ mới; không tự gửi lại.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`AI-Bridge trả lỗi HTTP ${response.status}. Kiểm tra tab trước khi chủ động thử lại.`);
  }
  const body = await jsonOf(response);
  if (!Array.isArray(body.media) || !body.media.length || body.media.length > 4)
    throw new Error("AI-Bridge chưa trả về media cuối được xác minh; không tự gửi lại prompt.");
  const assets: MediaAsset[] = [];
  for (const item of body.media) {
    if (!item || item.kind !== kind || !uuidPattern.test(item.id ?? "") || !Number.isSafeInteger(item.size)
      || item.size < 12 || item.size > 64 * 1024 * 1024
      || !/^[a-f0-9]{64}$/.test(item.sha256 ?? "") || !(kind === "image" ? validImages : validVideos).includes(item.mime_type))
      throw new Error("Metadata kết quả AI-Bridge sai định dạng hoặc checksum.");
    const file = await context.tool.fetch(`${base}/media/${item.id}`, {
      headers, signal: signalFor(context, 60000), redirect: "error",
    });
    if (!file.ok) {
      await file.body?.cancel();
      throw new Error(`Không tải được media cuối (HTTP ${file.status}); không gửi lại prompt.`);
    }
    const claimed = file.headers.get("content-type")?.split(";")[0].toLowerCase();
    if (claimed !== item.mime_type || Number(file.headers.get("content-length")) !== item.size) {
      await file.body?.cancel();
      throw new Error("MIME/dung lượng media khác metadata AI-Bridge.");
    }
    const bytes = await bytesOf(file, 64 * 1024 * 1024);
    if (bytes.length !== item.size || !signature(bytes, item.mime_type) || sha256(bytes) !== item.sha256)
      throw new Error("Media AI-Bridge không vượt qua kiểm tra chữ ký tệp và SHA-256.");
    assets.push({ type: "binary", mediaType: kind, mimeType: item.mime_type, data: bytes });
  }
  return assets;
}

export default {
  id: "aiBridgeLocal",
  label: "AI-Bridge cục bộ (tab Chrome đã chọn)",
  version: "0.6.0",
  readme: "Adapter cho giao thức v0.6.0 dùng POST /v1/input-images + input_images ID. Hai mô hình là loại tác vụ, không khẳng định mọi AI đều hỗ trợ. Chỉ gửi đến tab đang sẵn sàng và được ghim chính xác. Chưa nghiệm thu upload trên website AI thật; nếu thất bại sẽ chặn gửi, không hạ cấp thành prompt chữ.",
  rules,
  models: [
    { id: "image", label: "Ảnh · AI-Bridge (yêu cầu tab hỗ trợ)", type: "image" },
    { id: "video", label: "Video · AI-Bridge (yêu cầu tab hỗ trợ)", type: "video", mode: ["text", "singleImage"] },
  ] satisfies ProviderModel[],
  generateImage(this: Context, request: ImageRequest): Promise<MediaAsset[]> {
    if (typeof this.tool.fetch !== "function") throw new Error("Toonflow chưa cấp công cụ fetch cho AI-Bridge.");
    return run(this, "image", request);
  },
  generateVideo(this: Context, request: VideoRequest): Promise<MediaAsset[]> {
    if (typeof this.tool.fetch !== "function") throw new Error("Toonflow chưa cấp công cụ fetch cho AI-Bridge.");
    return run(this, "video", request);
  },
  async resumeTask(this: Context, data: ProviderTaskData): Promise<MediaAsset[]> {
    if (data.transport !== "aiBridgeLocal") throw new Error("Không có trạng thái AI-Bridge phù hợp để khôi phục.");
    throw new Error("AI-Bridge chưa có API truy vấn lại kết quả sau khi mất kết nối. Hãy kiểm tra đúng tab; tuyệt đối không gửi lại tự động.");
  },
} satisfies ProviderDefinition<typeof rules>;
