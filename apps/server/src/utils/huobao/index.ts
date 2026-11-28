import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { requireDirectModelAccess } from "@/utils/multiTenant/gateway";
import { generateText } from "./text";
import { downloadMedia, generateImage, getTransferMedia, imageForm, mediaTypes, pollMedia, readHuobaoMedia, startVideo } from "./media";

const specifications = {
  text: { alias: "macflow-text", provider: "openai", label: "MacFlow · Văn bản", env: "TOONFLOW_HUOBAO_TEXT" },
  image: { alias: "gpt-image-macflow", provider: "openai", label: "MacFlow · Ảnh", env: "TOONFLOW_HUOBAO_IMAGE" },
  video: { alias: "doubao-seedance-2-0-macflow", provider: "volcengine", label: "MacFlow · Video", env: "TOONFLOW_HUOBAO_VIDEO" },
} as const;
type Service = keyof typeof specifications;
const services: Service[] = ["text", "image", "video"];
const modelSchema = z.object({ providerId: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,95}$/), modelId: z.string().trim().min(1).max(256) })
  .refine(item => item.providerId !== "aiChrome" && item.providerId !== "toonflow");
const modelsSchema = z.object({ text: modelSchema.nullable().optional(), image: modelSchema.nullable().optional(), video: modelSchema.nullable().optional() });
const pathSchema = z.string().trim().min(1).max(2048);

function fail(message: string, status: number): never { throw Object.assign(new Error(message), { status }); }

function sharedToken() {
  const token = process.env.TOONFLOW_HUOBAO_TOKEN ?? "";
  return /^[a-zA-Z0-9_-]{32,256}$/.test(token) ? token : "";
}

function scopedToken(token: string, scope: "models" | "control") {
  return createHmac("sha256", token).update(`macflow-huobao-${scope}-v1`).digest("hex");
}

function matchesToken(req: Request, token: string) {
  const actual = Buffer.from(req.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function serviceUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    fail("Địa chỉ Huobao và MacFlow phải là URL gốc HTTP/HTTPS.", 503);
  }
  return url.origin;
}

function endpoint() {
  const origin = serviceUrl(process.env.TOONFLOW_HUOBAO_ORIGIN || "http://127.0.0.1:5679");
  const publicUrl = serviceUrl(process.env.TOONFLOW_HUOBAO_PUBLIC_URL || "http://127.0.0.1:5679");
  return { origin, publicUrl };
}

function selection(service: Service) {
  const saved = modelsSchema.safeParse(u.conf.get("huobaoModels"));
  if (saved.success && saved.data[service] !== undefined) return saved.data[service];
  const value = process.env[specifications[service].env];
  const match = /^([a-zA-Z][a-zA-Z0-9]{0,95})\/(\S.{0,255})$/.exec(value?.trim() ?? "");
  if (!match || ["aiChrome", "toonflow"].includes(match[1]!)) return null;
  return { providerId: match[1]!, modelId: match[2]! };
}

async function apiSettings(req: Request) {
  const token = sharedToken();
  const value = process.env.TOONFLOW_HUOBAO_MACFLOW_ORIGIN;
  const folder = process.env.TOONFLOW_HUOBAO_PROJECT;
  if (!token || !value || !folder || isAbsolute(folder) ||
    /[\\/:\x00-\x1f]/.test(folder) || [".", ".."].includes(folder)) fail("Chưa cấu hình kết nối mô hình Huobao trong máy chủ MacFlow.", 503);
  const root = await u.workspace.getWorkspaceRoot(req);
  const path = await u.workspace.resolveWorkspace(req, resolve(root, folder));
  if (path !== resolve(root, folder)) fail("Chọn một dự án thường trong thư mục workspaces của MacFlow.", 403);
  return { ...endpoint(), apiBase: `${serviceUrl(value)}/api/huobao/bridge`, token, workspace: path };
}

async function huobaoRequest(path: string, method = "GET", body?: FormData | Record<string, unknown>, wait = 30000) {
  const form = body instanceof FormData;
  const response = await fetch(new URL(`/api/v1${path}`, endpoint().origin), {
    method, redirect: "error", signal: AbortSignal.timeout(wait),
    headers: body && !form ? { "Content-Type": "application/json" } : undefined,
    body: form ? body : body ? JSON.stringify(body) : undefined,
  }).catch(() => fail("Không kết nối được Huobao Drama. Kiểm tra tiến trình và địa chỉ.", 502));
  if (!response.ok) {
    await response.body?.cancel();
    fail(`Huobao trả lỗi HTTP ${response.status}.`, 502);
  }
  return response.json();
}

async function assertAvailable(service: Service, model: NonNullable<ReturnType<typeof selection>>) {
  if (service === "text") {
    const configured = await u.ai.getConfiguredModel(model.providerId, model.modelId);
    if (configured.publicProviderId === "muse2Api") fail("Mô hình văn bản cho Huobao phải hỗ trợ gọi công cụ Agent.", 400);
  } else if (!(await u.mediaGeneration.listMediaModels()).some(item => item.type === service &&
    item.providerId === model.providerId && item.modelId === model.modelId && item.configured !== false)) {
    fail("Mô hình ảnh hoặc video chưa sẵn sàng. Hãy kiểm tra cấu hình trong MacFlow.", 400);
  }
}

let syncing = false;
const router = Router();
const partner = Router();
router.use((_req, res, next) => {
  requireDirectModelAccess();
  res.set("Cache-Control", "no-store");
  next();
});
router.get("/status", async (req, res) => {
  u.mcpControl.assertAppRequest(req);
  const { publicUrl } = endpoint();
  const { modelSetup, online } = await Promise.all([
    apiSettings(req).then(() => true, () => false),
    huobaoRequest("/health", "GET", undefined, 4000).then(value => z.object({ status: z.literal("ok") }).safeParse(value).success, () => false),
  ]).then(([modelSetup, online]) => ({ modelSetup, online }));
  res.json(success({ publicUrl, online, modelSetup, models: services.flatMap(service => {
    const model = selection(service);
    return model ? [{ service, ...model }] : [];
  }) }));
});
async function listModels(_req: Request, res: Response) {
  const [text, media] = await Promise.all([u.ai.listAiModels(), u.mediaGeneration.listMediaModels()]);
  const eligible = (item: { providerId: string; modelId: string }) => modelSchema.safeParse(item).success;
  const catalogEntry = ({ providerId, modelId, label, providerLabel }: {
    providerId: string; modelId: string; label: string; providerLabel: string;
  }) => ({ providerId, modelId, label, providerLabel });
  res.json(success({
    text: text.filter(item => eligible(item) && item.providerId !== "muse2Api").map(catalogEntry),
    image: media.filter(item => eligible(item) && item.type === "image" && item.configured !== false).map(catalogEntry),
    video: media.filter(item => eligible(item) && item.type === "video" && item.configured !== false).map(catalogEntry),
    selected: Object.fromEntries(services.map(service => [service, selection(service)])),
  }));
}
async function configure(req: Request, res: Response) {
  const connection = await apiSettings(req);
  if (syncing) fail("Đang kết nối mô hình Huobao. Thử lại sau.", 409);
  syncing = true;
  try {
    const requested = modelsSchema.parse(req.body);
    const models = Object.fromEntries(services.map(service => [service, requested[service] === undefined ? selection(service) : requested[service]]));
    const selected = services.flatMap(service => {
      const model = models[service];
      return model ? [{ service, model }] : [];
    });
    if (!selected.length) fail("Chọn ít nhất một mô hình đã cài trong MacFlow để kết nối.", 400);
    await Promise.all(selected.map(({ service, model }) => assertAvailable(service, model)));
    const { data: existing } = z.object({ data: z.array(z.object({ id: z.number().int(), name: z.string(),
      provider: z.string(), service_type: z.string(), base_url: z.string() })) }).parse(await huobaoRequest("/ai-configs"));
    for (const { service } of selected) {
      const spec = specifications[service];
      const config = { name: spec.label, service_type: service, provider: spec.provider,
        base_url: connection.apiBase, api_key: scopedToken(connection.token, "models"), model: [spec.alias], priority: 10000, is_active: true };
      const record = existing.find(item => item.name === spec.label && item.service_type === service && item.provider === spec.provider &&
        item.base_url.endsWith("/api/huobao/bridge"));
      await huobaoRequest(record ? `/ai-configs/${record.id}` : "/ai-configs", record ? "PUT" : "POST", config);
    }
    for (const service of services.filter(item => !models[item])) {
      const spec = specifications[service];
      const record = existing.find(item => item.name === spec.label && item.service_type === service && item.provider === spec.provider &&
        item.base_url.endsWith("/api/huobao/bridge"));
      if (record) await huobaoRequest(`/ai-configs/${record.id}`, "PUT", { is_active: false });
    }
    u.conf.set("huobaoModels", modelsSchema.parse(models));
    res.json(success({ count: selected.length }));
  } finally { syncing = false; }
}

async function uploadAsset(assetPath: string, onlyImages = false) {
  const { content } = await u.assets.readAssetFile(assetPath);
  const { bytes, mimeType } = getTransferMedia(content);
  if (onlyImages && !mimeType.startsWith("image/")) fail("Hãy chọn ảnh PNG, JPEG hoặc WebP.", 400);
  const form = new FormData();
  const kind = mimeType.split("/")[0]!;
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), `macflow.${mediaTypes.get(mimeType)}`);
  const upload = z.object({ data: z.object({ path: z.string().regex(/^\/?static\//) }) }).parse(await huobaoRequest(`/upload/${kind}`, "POST", form));
  return { path: upload.data.path, url: new URL(upload.data.path, endpoint().publicUrl).href };
}

router.get("/models", (req, res) => { u.mcpControl.assertAppRequest(req); return listModels(req, res); });
router.post("/configure", (req, res) => { u.mcpControl.assertAppRequest(req); return configure(req, res); });
router.post("/exportAsset", async (req, res) => {
  u.mcpControl.assertAppRequest(req);
  const { assetPath } = z.object({ assetPath: pathSchema }).parse(req.body);
  res.json(success(await uploadAsset(assetPath)));
});

partner.use((req, _res, next) => {
  const token = sharedToken();
  if (req.get("origin") || !token || !matchesToken(req, scopedToken(token, "control"))) fail("Kết nối quản lý Huobao không hợp lệ.", 403);
  next();
});
partner.get("/models", async (req, res) => { await apiSettings(req); await listModels(req, res); });
partner.post("/configure", configure);
partner.get("/images", async (req, res) => {
  const { path, cursor } = z.object({ path: pathSchema.optional(), cursor: z.string().max(100).optional() }).parse(req.query);
  const result = await u.assets.queryAssets({ path, cursor, limit: 40 });
  res.json(success({ ...result, items: result.items.filter(item => item.type === "directory" || /\.(png|jpe?g|webp)$/i.test(item.name)) }));
});
partner.get("/image", async (req, res) => {
  const { path } = z.object({ path: pathSchema }).parse(req.query);
  const { content } = await u.assets.readAssetFile(path);
  const { bytes, mimeType } = getTransferMedia(content);
  if (!mimeType.startsWith("image/")) fail("Hãy chọn ảnh PNG, JPEG hoặc WebP.", 400);
  res.set({ "Content-Type": mimeType, "X-Content-Type-Options": "nosniff" }).send(bytes);
});
partner.post("/useImage", async (req, res) => {
  const { assetPath } = z.object({ assetPath: pathSchema }).parse(req.body);
  res.json(success(await uploadAsset(assetPath, true)));
});
router.use("/partner", partner);
router.post("/importAsset", async (req, res) => {
  u.mcpControl.assertAppRequest(req);
  const { assetPath } = z.object({ assetPath: pathSchema }).parse(req.body);
  const { bytes, mimeType } = await readHuobaoMedia(endpoint(), assetPath);
  await u.assets.createAssetDirectory("Huobao").catch((cause: NodeJS.ErrnoException) => { if (cause.code !== "EEXIST") throw cause; });
  const { path } = await u.assets.writeAssetFile(`Huobao/${randomUUID()}.${mediaTypes.get(mimeType)}`, bytes);
  res.json(success({ path }));
});

const bridge = Router();
bridge.get("/output/:type/:ticket/:filename", async (req, res, next) => {
  const type = z.enum(["image", "video"]).parse(req.params.type);
  await downloadMedia(res, await apiSettings(req), type, req.params.ticket, req.params.filename, next);
});
bridge.use((req, _res, next) => {
  const token = sharedToken();
  if (req.get("origin") || !token) fail("Cầu nối AI Huobao chỉ nhận yêu cầu máy chủ đã xác thực.", 403);
  if (!matchesToken(req, scopedToken(token, "models")) && !matchesToken(req, token)) fail("Mã kết nối Huobao không hợp lệ.", 401);
  next();
});
function modelFor(service: Service) {
  const model = selection(service);
  if (!model) fail(`Chưa chọn mô hình MacFlow cho dịch vụ ${service}.`, 503);
  return model;
}
bridge.get("/v1/models", (_req, res) => {
  res.json({ object: "list", data: services.filter(service => service !== "video" && selection(service)).map(service => ({
    id: specifications[service].alias, object: "model", owned_by: "macflow",
  })) });
});
bridge.post("/v1/chat/completions", async (req, res) => {
  await apiSettings(req);
  await generateText(req, res, modelFor("text"), specifications.text.alias);
});
bridge.post(["/v1/images/generations", "/v1/images/edits"], imageForm, async (req, res) => {
  await generateImage(req, res, await apiSettings(req), modelFor("image"), specifications.image.alias);
});
bridge.get("/v1/images/task/:ticket", async (req, res) => {
  await pollMedia(res, await apiSettings(req), "image", req.params.ticket);
});
bridge.post("/api/v3/contents/generations/tasks", async (req, res) => {
  // Huobao probes with an empty body before enabling a provider.
  if (req.body && !Object.keys(req.body).length) {
    await assertAvailable("video", modelFor("video"));
    res.json({ status: "ready" });
    return;
  }
  await startVideo(req, res, await apiSettings(req), modelFor("video"), specifications.video.alias);
});
bridge.get("/api/v3/contents/generations/tasks/:ticket", async (req, res) => {
  await pollMedia(res, await apiSettings(req), "video", req.params.ticket);
});
router.use("/bridge", bridge);
export default router;
