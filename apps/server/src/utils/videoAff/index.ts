import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { detectMimeType } from "@/utils/media/priceReference";
import { requireDirectModelAccess } from "@/utils/multiTenant/gateway";
import bridge from "./bridge";
import { localVideoAffAvailable, localVideoAffStatus, startLocalVideoAff } from "./local";
import { configuredModels, fail, imageFormat, modelSelections, selectionSchema, videoAffModels,
  videoAffOrigin, videoAffPublicUrl, videoAffToken } from "./config";

const router = Router();
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/);
const assetPathSchema = z.string().trim().min(1).max(2048);
const productsPath = "/api/v1/products";
const maxVideoBytes = 100 * 1024 * 1024;
const personasSchema = z.array(z.object({ id: idSchema, name: z.string() }));
const videosSchema = z.array(z.object({ product_id: idSchema, title: z.string().nullish(),
  product_title: z.string().nullish(), has_cover: z.boolean() }));

async function videoAffRequest(path: string, init?: RequestInit, timeout = 12_000) {
  const response = await fetch(new URL(path, videoAffOrigin()), {
    ...init, signal: AbortSignal.timeout(timeout), redirect: "error",
  }).catch(() => fail("Chưa kết nối được VideoAFF. Kiểm tra ứng dụng VideoAFF đã chạy.", 502));
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    if (response.status === 404) fail("Không tìm thấy nội dung đã chọn trong VideoAFF.", 404);
    fail(`VideoAFF chưa thực hiện được thao tác (HTTP ${response.status}). Hãy kiểm tra dữ liệu trong VideoAFF.`, 502);
  }
  return response;
}

function modelOption(item: { providerId: string; modelId: string; label: string; providerLabel: string }) {
  const { providerId, modelId, label, providerLabel } = item;
  return { providerId, modelId, label, providerLabel };
}

async function catalog() {
  const [language, media] = await Promise.all([u.ai.listAiModels(), u.mediaGeneration.listMediaModels()]);
  const text = language.filter(item => item.providerId !== "muse2Api" && selectionSchema.safeParse(item).success).map(modelOption);
  const available = media.filter(item => item.configured !== false && selectionSchema.safeParse(item).success);
  return {
    writer: text, review: text,
    image: available.filter(item => item.type === "image" && (item.referenceLimits?.maxReferences ?? 1) > 0).map(modelOption),
    video: available.filter(item => item.type === "video" && Array.isArray(item.mode)
      && item.mode.some(mode => ["startFrameOptional", "endFrameOptional", "singleImage"].includes(mode))
      && (!item.durationResolutionMap?.length || item.durationResolutionMap.some(option => option.duration.includes(15)))).map(modelOption),
    audio: available.filter(item => item.type === "audio").map(modelOption),
  };
}

router.use((_req, res, next) => {
  requireDirectModelAccess();
  res.set("Cache-Control", "no-store");
  next();
});
router.use("/bridge/v1", bridge);
router.use((req, _res, next) => { u.mcpControl.assertAppRequest(req); next(); });

function videoAffOnline() {
  return videoAffRequest("/health/ready", undefined, 2500).then(async response => {
    return z.object({ status: z.literal("ok"), service: z.literal("affiliate-content-api") }).safeParse(await response.json()).success;
  }).catch(() => false);
}

router.get("/status", async (req, res) => {
  const [online, canStart] = await Promise.all([
    localVideoAffStatus().phase === "starting" ? false : videoAffOnline(),
    localVideoAffAvailable(req),
  ]);
  res.json(success({ publicUrl: videoAffPublicUrl(), online, canStart, local: localVideoAffStatus(),
    bridgeReady: Boolean(videoAffToken()), selections: configuredModels() }));
});

router.post("/local/start", async (req, res) => {
  if (!await localVideoAffAvailable(req)) fail("Hãy mở MacFlow trực tiếp trên máy có mã nguồn VideoAFF để khởi động.", 403);
  if (localVideoAffStatus().phase !== "starting" && !await videoAffOnline()) startLocalVideoAff(req);
  res.status(202).json(success({ local: localVideoAffStatus() }));
});

router.get("/models", async (_req, res) => {
  res.json(success(await catalog()));
});

router.put("/models", async (req, res) => {
  if (!videoAffToken()) fail("Chưa thiết lập mã kết nối VideoAFF trong MacFlow.", 503);
  const selected = modelSelections.parse(req.body);
  const models = await catalog();
  for (const kind of videoAffModels) {
    const selection = selected[kind];
    if (selection && !models[kind].some(model => model.providerId === selection.providerId && model.modelId === selection.modelId)) {
      fail("Một mô hình đã chọn không còn phù hợp. Hãy làm mới danh sách mô hình.");
    }
  }
  u.conf.set("videoAffModels", selected);
  res.json(success({ selections: selected }));
});

router.get("/library", async (_req, res) => {
  const [people, finished] = await Promise.all([
    videoAffRequest(`${productsPath}/persona`).then(response => response.json()),
    videoAffRequest(`${productsPath}/outputs`).then(response => response.json()),
  ]);
  const videos = videosSchema.parse(finished).map(video => ({
    id: video.product_id, name: video.title || video.product_title || video.product_id, hasCover: video.has_cover,
  }));
  res.json(success({ people: personasSchema.parse(people), videos }));
});

router.post("/personPhoto", async (req, res) => {
  const { id, path } = z.object({ id: idSchema, path: assetPathSchema, rights: z.literal(true) }).parse(req.body);
  const { content } = await u.assets.readAssetFile(path);
  const { mimeType } = imageFormat(content);
  const response = await videoAffRequest(`${productsPath}/persona/${id}/image?rights=confirmed&add=true`, {
    method: "PUT", body: new Uint8Array(content), headers: { "Content-Type": mimeType },
  }, 30_000);
  await response.body?.cancel().catch(() => {});
  res.json(success({ person: id }));
});

router.post("/saveOutput", async (req, res) => {
  const { id, kind } = z.object({ id: idSchema, kind: z.enum(["video", "cover"]) }).parse(req.body);
  const response = await videoAffRequest(`${productsPath}/${id}/${kind}`, undefined, 90_000);
  const limit = kind === "video" ? maxVideoBytes : 10 * 1024 * 1024;
  if (!response.body || Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel().catch(() => {});
    fail("Tệp VideoAFF trống hoặc vượt dung lượng Kho MacFlow cho phép.", 413);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > limit) fail("Tệp VideoAFF vượt dung lượng Kho MacFlow cho phép.", 413);
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = Buffer.concat(chunks, length);
  const wanted = kind === "video" ? "video/mp4" : "image/jpeg";
  if (detectMimeType(bytes, "") !== wanted) fail("Tệp kết quả VideoAFF không đúng định dạng.", 422);
  await u.assets.createAssetDirectory("VideoAFF").catch((cause: NodeJS.ErrnoException) => {
    if (cause.code !== "EEXIST") throw cause;
  });
  const { path } = await u.assets.writeAssetFile(`VideoAFF/${id}-${randomUUID().slice(0, 8)}.${kind === "video" ? "mp4" : "jpg"}`, bytes);
  res.json(success({ path }));
});
export default router;
