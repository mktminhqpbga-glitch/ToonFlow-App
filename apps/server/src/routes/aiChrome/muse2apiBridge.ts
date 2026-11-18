/** Private loopback bridge for the optional Python Muse2API extension driver.
 * Never calls the Muse2API media provider: this goes straight to the existing
 * tab-pinned Chrome queue, so Python -> MacFlow -> Muse2API recursion is impossible.
 * This route is disabled unless a dedicated shared secret is configured.
 */
import { Router, type Request } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { join, dirname } from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { writeAtomic, mkdir } from "@toonflow/file";
import conf from "@/utils/conf";
import {
  online, managedMuseTargets, manageMuseTabs, runTask, completeTask, failTask,
  museProfileStatus, verifyMuseNetwork,
} from "@/utils/aiChrome";
import { validateFile } from "@/utils/aiChrome/files";
import type { ReferenceFile } from "@/utils/aiChrome/files";

const router = Router();
const loopback = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const hosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const tokenEnv = "MACFLOW_MUSE2API_BRIDGE_TOKEN";
const idSchema = z.uuid().refine(value => value === value.toLowerCase());
const imageFile = z.strictObject({
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  label: z.string().min(1).max(256),
  dataBase64: z.string().min(4).max(90_000_000),
});
const requestSchema = z.strictObject({
  id: idSchema, kind: z.enum(["text", "image", "video"]),
  prompt: z.string().trim().min(1).max(90000),
  specification: z.record(z.string(), z.json()).optional(),
  files: z.array(imageFile).max(8).default([]),
});

function bridgeAuth(req: Request): void {
  const expected = process.env[tokenEnv] ?? "";
  const provided = req.get("X-MacFlow-Muse-Bridge-Token") ?? "";
  if (!loopback.has(req.socket.remoteAddress ?? "") || !hosts.has(req.hostname)
    || req.get("Origin") || expected.length < 32 || provided.length !== expected.length
    || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    throw Object.assign(new Error("Muse2API bridge không được cấp quyền từ localhost."), { status: 403 });
  }
}
function status() {
  const managed = managedMuseTargets();
  const profile = museProfileStatus();
  const usable = profile.verified && managed.length === 5 && managed.every(target =>
    ["text", "image", "video"].every(kind => target.outputKinds.includes(kind as "text" | "image" | "video")));
  return {
    connected: online(), ready: usable, tabs: managed.length,
    busy_tabs: managed.filter(target => target.busy).length,
    profile: { selectedProfile: profile.selectedProfile, confirmed: profile.confirmed,
      verified: profile.verified, proxyMode: profile.proxyMode, countryCode: profile.countryCode,
      checkedAt: profile.checkedAt, reason: profile.reason },
    targets: managed.map(target => ({ tabId: target.tabId, documentToken: target.documentToken, url: target.url,
      ready: target.ready, busy: target.busy, blocked: target.blocked, outputKinds: target.outputKinds })),
  };
}
function fail(res: import("express").Response, cause: unknown) {
  const error = cause instanceof Error ? cause : new Error(String(cause));
  const code = (error as Error & { status?: number }).status ?? 503;
  if (!res.headersSent) res.status(code).set("Cache-Control", "no-store").json({ error: error.message.slice(0, 600) });
}
function resultPaths(id: string) {
  const root = join(dirname(conf.path), "aiChromeTasks");
  return { root, file: join(root, `${id}.muse2api-result.bin`), info: join(root, `${id}.muse2api-result.json`) };
}
let nextMuseTab = 0;

router.use((req, res, next) => {
  try { bridgeAuth(req); res.set("Cache-Control", "no-store"); next(); }
  catch (error) { fail(res, error); }
});
router.get("/status", (_req, res) => { res.json(status()); });

// Read-only network preflight. No Muse tab is opened and no AI prompt is sent.
// The extension tests its own effective proxy and public exit country.
router.post("/verify", async (_req, res) => {
  try {
    await verifyMuseNetwork();
    res.json(status());
  } catch (error) { fail(res, error); }
});

// This is an *explicit* authorized operation; startup never opens Chrome.
// The extension can open tabs only in its own existing Chrome profile.
router.post("/ensure", async (req, res) => {
  try {
    if (req.body?.confirmExistingProfile22 !== true)
      throw Object.assign(new Error("Cần xác nhận extension đang chạy trong Chrome Profile 22 hiện có."), { status: 400 });
    if (!online()) throw new Error("Extension chưa kết nối; không mở Chrome mới.");
    // Verify *before opening any tabs*. A UI-selected label is not proof of a
    // configured proxy or actual US public egress.
    await verifyMuseNetwork();
    if (status().tabs === 5) { res.json(status()); return; }
    await manageMuseTabs();
    res.json(status());
  } catch (error) { fail(res, error); }
});

router.post("/run", async (req, res) => {
  let id: string | undefined;
  try {
    const data = requestSchema.parse(req.body);
    id = data.id;
    if (managedMuseTargets().length !== 5)
      throw new Error("Chưa có đủ 5 tab Muse đã xác minh trong extension; không gửi AI.");
    if (data.kind === "video" && data.files.length > 1) throw new Error("Video Muse2API chỉ hỗ trợ ảnh khung đầu tiên.");
    const files: ReferenceFile[] = [];
    let size = 0;
    for (const file of data.files) {
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.dataBase64))
        throw Object.assign(new Error("Ảnh tham chiếu không phải Base64 chuẩn."), { status: 400 });
      const bytes = Buffer.from(file.dataBase64, "base64");
      if (bytes.toString("base64") !== file.dataBase64) throw Object.assign(new Error("Base64 ảnh tham chiếu không nguyên vẹn."), { status: 400 });
      validateFile(bytes, file.mimeType, "image");
      size += bytes.length;
      if (size > 64 * 1024 * 1024) throw Object.assign(new Error("Tổng ảnh tham chiếu quá 64 MB."), { status: 400 });
      files.push({ bytes, mimeType: file.mimeType, label: file.label });
    }
    // Fresh profile check for each request. Never trust a cached 'ready' value:
    // readiness may expire between jobs. Check again at dispatch and just
    // before 'run' for queued tasks (the proxy can change during upload).
    await verifyMuseNetwork();
    if (!status().ready) throw new Error("Profile 22, proxy hoặc IP Mỹ không được xác minh; chưa gửi tác vụ Muse.");
    // Round-robin among five owned tabs only. runTask freezes tabId and documentToken.
    const managed = managedMuseTargets();
    if (managed.length !== 5) throw new Error("Danh sách 5 tab Muse đã thay đổi khi kiểm tra proxy/IP. Không gửi.");
    const tab = managed[nextMuseTab++ % 5]!;
    const result = await runTask({ id: data.id, kind: data.kind, modelId: "museChrome",
      tabId: tab.tabId, prompt: data.prompt, specification: data.specification ?? {}, files,
      preflight: async () => {
        await verifyMuseNetwork();
        const stillOwned = managedMuseTargets().find(target => target.tabId === tab.tabId
          && target.documentToken === tab.documentToken && target.url === tab.url);
        if (!stillOwned || managedMuseTargets().length !== 5)
          throw new Error("Tab Muse đã không còn thuộc đúng Profile 22/pool 5 tab. Không gửi.");
      },
      save: async () => {} });
    const paths = resultPaths(id);
    await mkdir(paths.root, { recursive: true });
    const meta = { id, kind: result.kind, mimeType: result.mimeType,
      sha256: createHash("sha256").update(result.bytes).digest("hex"), size: result.bytes.length };
    // Make bytes recoverable by task UUID BEFORE acknowledging 'saved' to extension.
    await writeAtomic(paths.file, result.bytes, { mode: 0o600 });
    await writeAtomic(paths.info, JSON.stringify(meta), { mode: 0o600 });
    await completeTask(id);
    if (!res.destroyed) res.json({ ...meta, dataBase64: Buffer.from(result.bytes).toString("base64") });
  } catch (error) {
    if (id) failTask(id, error);
    fail(res, error);
  }
});

router.get("/result/:id", async (req, res) => {
  try {
    const id = idSchema.parse(req.params.id);
    const paths = resultPaths(id);
    const [metaRaw, bytes] = await Promise.all([readFile(paths.info, "utf8"), readFile(paths.file)]);
    const meta = z.strictObject({ id: idSchema, kind: z.enum(["text", "image", "video"]),
      mimeType: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().positive() }).parse(JSON.parse(metaRaw));
    if (meta.id !== id || meta.size !== bytes.length || createHash("sha256").update(bytes).digest("hex") !== meta.sha256)
      throw new Error("Kết quả lưu không khớp checksum.");
    res.json({ ...meta, dataBase64: bytes.toString("base64") });
  } catch { res.status(404).json({ error: "Chưa tìm thấy kết quả đã lưu cho ID này; không tự gửi lại prompt." }); }
});
export default router;
