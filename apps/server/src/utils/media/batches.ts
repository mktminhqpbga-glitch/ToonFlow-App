import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { lstat, mkdir, readdir, readFile, realpath } from "@toonflow/file";
import { createWorkspaceFfmpeg } from "@/utils/ffmpeg";
import { chromeBridge } from "@/utils/chromeBridge/manager";
import { areConcatStreamsCompatible, canDispatchBatch, mayResumeBatch, nextQueuedIndex, recoverRunningScene } from "./batchTransitions";
import { z } from "zod";
import type { AuthIdentity } from "@toonflow/multi-tenant-auth";
import { imageGenerationSchema, videoGenerationSchema } from "./schemas";
import * as mediaTasks from "./tasks";
import { resolveWorkspacePath, writeWorkspaceFile } from "@/utils/workspace/files";

const kindSchema = z.enum(["image", "video"]);
const sceneState = z.enum(["queued", "running", "succeeded", "failed", "unknown", "cancelled"]);
const batchState = z.enum(["running", "paused", "completed", "cancelled"]);
const sceneSchema = z.object({
  id: z.uuid(), taskId: z.uuid(), index: z.number().int().nonnegative(),
  deviceId: z.string().max(256).optional(), tabId: z.number().int().nonnegative().optional(),
  providerId: z.string().max(96).optional(),
  state: sceneState,
  request: z.union([imageGenerationSchema, videoGenerationSchema]),
  result: z.array(z.object({ path: z.string(), mimeType: z.string(), mediaType: kindSchema })).optional(),
  error: z.string().max(2000).optional(),
});
const batchSchema = z.object({
  version: z.literal(1), id: z.uuid(), kind: kindSchema, ownerUserId: z.uuid().optional(),
  state: batchState, createdAt: z.number().int(), updatedAt: z.number().int(),
  scenes: z.array(sceneSchema).min(1).max(100),
  merged: z.object({ path: z.string(), mimeType: z.literal("video/mp4") }).optional(),
});
type Batch = z.infer<typeof batchSchema>;
type Kind = z.infer<typeof kindSchema>;
const locks = new Map<string, Promise<void>>();
const runningBatches = new Map<string, Promise<void>>();
// Conservative global dispatch: no two queued batch jobs use the same Chrome tab at once.
let dispatchQueue: Promise<void> = Promise.resolve();

function invalid(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
function verifyOwner(batch: Batch, owner?: AuthIdentity | null) {
  if (batch.ownerUserId && owner?.role !== "admin" && (owner?.role !== "user" || owner.id !== batch.ownerUserId)) invalid("Không có quyền xem batch này", 403);
  if (!batch.ownerUserId && owner?.role === "user") invalid("Không có quyền xem batch này", 403);
}
async function filePath(cwd: string, id: string) {
  z.uuid().parse(id);
  return (await resolveWorkspacePath(cwd, `batchJobs/${id}.json`, true)).path;
}
async function readBatch(cwd: string, id: string, owner?: AuthIdentity | null) {
  const path = await filePath(cwd, id);
  let json: string;
  try { json = await readFile(path, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") invalid("Batch không tồn tại", 404);
    throw error;
  }
  const batch = batchSchema.parse(JSON.parse(json));
  if (batch.id !== id) invalid("Batch ID không khớp", 409);
  verifyOwner(batch, owner);
  return batch;
}
async function locked<T>(path: string, action: () => Promise<T>) {
  const previous = locks.get(path) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.then(() => current);
  locks.set(path, tail);
  await previous;
  try { return await action(); }
  finally { release(); if (locks.get(path) === tail) locks.delete(path); }
}
async function mutateBatch<T>(cwd: string, id: string, owner: AuthIdentity | null | undefined, action: (batch: Batch) => T) {
  const path = await filePath(cwd, id);
  return locked(path, async () => {
    const batch = await readBatch(cwd, id, owner);
    const result = action(batch);
    batch.updatedAt = Date.now();
    await writeWorkspaceFile(path, JSON.stringify(batch, null, 2) + "\n");
    return result;
  });
}
function safeError(cause: unknown) {
  return (cause instanceof Error ? cause.message : "Tác vụ gặp lỗi").slice(0, 1000);
}
function exposed(batch: Batch) {
  const { ownerUserId, ...safe } = batch;
  return safe;
}
async function reconcile(cwd: string, id: string, index: number, owner?: AuthIdentity | null) {
  const batch = await readBatch(cwd, id, owner);
  const scene = batch.scenes[index];
  if (!scene || scene.state !== "running") return;
  const [task] = await mediaTasks.inspect(cwd, [scene.taskId], owner);
  const observed = recoverRunningScene({ state: task?.state ?? "unknown", active: task?.active === true,
    validResult: !!(task?.result?.data?.length && task.result.data.every(file => file.mediaType === batch.kind)) });
  if (observed === "running") return "running" as const;
  if (observed === "succeeded" && task?.result?.data?.length) {
    const verified = task.result.data.map(file => ({ path: file.path, mimeType: file.mimeType, mediaType: batch.kind }));
    await mutateBatch(cwd, id, owner, record => {
      const current = record.scenes[index];
      if (current?.state === "running") { current.state = "succeeded"; current.result = verified; }
    });
    return "succeeded" as const;
  }
  if (observed === "failed" || observed === "cancelled") {
    await mutateBatch(cwd, id, owner, record => {
      const current = record.scenes[index];
      if (current?.state === "running") {
        current.state = observed;
        current.error = task.result?.message?.slice(0, 1000) ?? "Tác vụ thất bại";
      }
    });
    return "failed" as const;
  }
  // Incomplete upstream submission is UNKNOWN; never submit again automatically.
  await mutateBatch(cwd, id, owner, record => {
    const current = record.scenes[index];
    if (current?.state === "running") {
      current.state = "unknown";
      current.error = "Không xác nhận được tác vụ đã gửi tới AI hay chưa. Không tự gửi lại.";
      record.state = "paused";
    }
  });
  return "unknown" as const;
}
async function processBatch(cwd: string, id: string, owner?: AuthIdentity | null) {
  while (true) {
    const batch = await readBatch(cwd, id, owner);
    if (batch.state !== "running") return;
    const activeIndex = batch.scenes.findIndex(scene => scene.state === "running");
    if (activeIndex >= 0) {
      const status = await reconcile(cwd, id, activeIndex, owner);
      if (status === "unknown") return;
      if (status === "running") {
        try { await mediaTasks.wait(cwd, batch.scenes[activeIndex]!.taskId, owner); }
        catch { /* Reconcile the exact persisted task below. */ }
        const checked = await reconcile(cwd, id, activeIndex, owner);
        if (checked === "unknown" || checked === "running") return;
      }
      continue;
    }
    const nextIndex = nextQueuedIndex(batch.scenes);
    const next = nextIndex < 0 ? undefined : batch.scenes[nextIndex];
    if (!next) {
      await mutateBatch(cwd, id, owner, current => {
        if (current.state === "running") current.state = "completed";
      });
      return;
    }
    // Persist the generated task ID and RUNNING state before any provider-side submission.
    // Record the actual selected device/tab identity at dispatch, never a fabricated queue assignment.
    const bridge = chromeBridge.status();
    const provider = next.request.providerId === "chromeBridge"
      ? next.request.modelId.replace(/_(image|video)$/, "") : undefined;
    const selection = provider ? (bridge.selected as Record<string, { tab?: { id: number } }>)[provider] : undefined;
    const deviceId = provider && bridge.connected
      ? ("remote" in bridge && bridge.remote?.selectedDeviceId ? bridge.remote.selectedDeviceId : "local") : undefined;
    await mutateBatch(cwd, id, owner, current => {
      const scene = current.scenes[next.index];
      if (current.state === "running" && scene?.state === "queued") {
        scene.state = "running";
        scene.providerId = scene.request.providerId;
        if (selection && deviceId) { scene.deviceId = deviceId; scene.tabId = selection.tab?.id; }
      }
    });
    const current = await readBatch(cwd, id, owner);
    const scene = current.scenes[next.index];
    if (!scene || scene.state !== "running") continue;
    try {
      await mediaTasks.start(cwd, scene.taskId, current.kind, scene.request, {}, owner);
      await mediaTasks.wait(cwd, scene.taskId, owner);
    } catch (error) {
      // A provider failure is recorded per scene; independent scenes can continue.
      // Do not create a second task ID or resend any uncertain task.
      const checked = await reconcile(cwd, id, next.index, owner);
      if (checked === "unknown") return;
      if (checked !== "succeeded" && checked !== "failed") {
        await mutateBatch(cwd, id, owner, record => {
          const candidate = record.scenes[next.index];
          if (candidate?.state === "running") {
            candidate.state = "unknown";
            candidate.error = safeError(error);
            record.state = "paused";
          }
        });
        return;
      }
      continue;
    }
    const checked = await reconcile(cwd, id, next.index, owner);
    if (checked === "unknown" || checked === "running") return;
  }
}
function schedule(cwd: string, id: string, owner?: AuthIdentity | null) {
  const key = JSON.stringify([cwd, id]);
  if (runningBatches.has(key)) return;
  const task = dispatchQueue.then(() => processBatch(cwd, id, owner));
  dispatchQueue = task.catch(error => console.error("Batch task failed", safeError(error)));
  runningBatches.set(key, task);
  void task.finally(() => { if (runningBatches.get(key) === task) runningBatches.delete(key); })
    .catch(() => {});
}
export async function createBatch(cwd: string, kind: Kind, requests: unknown[], owner?: AuthIdentity | null) {
  cwd = await realpath(cwd);
  if (!requests.length || requests.length > 100) invalid("Một batch chỉ hỗ trợ 1–100 cảnh", 400);
  const parsed = requests.map(value => (kind === "image" ? imageGenerationSchema : videoGenerationSchema).parse(value));
  const id = randomUUID();
  const record: Batch = {
    version: 1, id, kind, ownerUserId: owner?.role === "user" ? owner.id : undefined,
    state: "running", createdAt: Date.now(), updatedAt: Date.now(),
    scenes: parsed.map((request, index) => ({
      id: randomUUID(), taskId: randomUUID(), index, state: "queued",
      request: { ...request, outputDirectory: `batchResults/${id}/scene-${index + 1}` },
    })),
  };
  const path = await filePath(cwd, id);
  await mkdir(dirname(path), { recursive: true });
  await writeWorkspaceFile(path, JSON.stringify(record, null, 2) + "\n", true);
  schedule(cwd, id, owner);
  return exposed(record);
}
export async function getBatch(cwd: string, id: string, owner?: AuthIdentity | null) {
  cwd = await realpath(cwd);
  return exposed(await readBatch(cwd, id, owner));
}
export async function listBatches(cwd: string, owner?: AuthIdentity | null) {
  cwd = await realpath(cwd);
  const directory = (await resolveWorkspacePath(cwd, "batchJobs", true)).path;
  const entries = await readdir(directory).catch((err: NodeJS.ErrnoException) => { if (err.code === "ENOENT") return []; throw err; });
  const batches: ReturnType<typeof exposed>[] = [];
  for (const filename of entries.filter(name => /^[a-f0-9-]{36}\.json$/i.test(name)).slice(0, 100)) {
    try { batches.push(exposed(await readBatch(cwd, filename.slice(0, -5), owner))); }
    catch (error) { if ((error as { status?: number }).status !== 403) console.warn("Skipping invalid batch record", filename); }
  }
  // Queue records survive process restart. Dispatch only records explicitly left running;
  // an in-flight task from the previous process is inspected without resubmission and
  // becomes UNKNOWN if its provider acknowledgement cannot be proven.
  for (const batch of batches) {
    if (canDispatchBatch(batch.state, batch.scenes))
      schedule(cwd, batch.id, owner);
  }
  return batches.sort((a, b) => b.createdAt - a.createdAt);
}
export async function controlBatch(cwd: string, id: string, action: "pause" | "resume" | "cancel", owner?: AuthIdentity | null) {
  cwd = await realpath(cwd);
  const state = await mutateBatch(cwd, id, owner, batch => {
    if (action === "pause" && batch.state === "running") batch.state = "paused";
    if (action === "resume" && mayResumeBatch(batch.state, batch.scenes)) batch.state = "running";
    if (action === "cancel" && !["completed", "cancelled"].includes(batch.state)) {
      batch.state = "cancelled";
      for (const scene of batch.scenes) if (scene.state === "queued") scene.state = "cancelled";
    }
    return batch.state;
  });
  if (action === "cancel") {
    const batch = await readBatch(cwd, id, owner);
    const ids = batch.scenes.filter(scene => scene.state === "running").map(scene => scene.taskId);
    if (ids.length) await mediaTasks.cancel(cwd, ids, owner);
  }
  if (action === "resume" && state === "running") schedule(cwd, id, owner);
  return getBatch(cwd, id, owner);
}

export async function mergeBatchVideos(cwd: string, id: string, owner?: AuthIdentity | null) {
  cwd = await realpath(cwd);
  const batch = await readBatch(cwd, id, owner);
  if (batch.kind !== "video" || batch.state !== "completed"
    || batch.scenes.length < 2 || batch.scenes.some(scene => scene.state !== "succeeded" || scene.result?.length !== 1))
    invalid("Chỉ ghép batch video khi tất cả cảnh đã tạo thành công và có đúng một video mỗi cảnh", 409);
  if (batch.merged) return batch.merged;
  const sources = [];
  for (const scene of batch.scenes) {
    const file = scene.result![0]!;
    if (file.mediaType !== "video" || !/^video\/(mp4|quicktime)$/i.test(file.mimeType))
      invalid("Chỉ có thể ghép các video MP4/MOV hợp lệ", 400);
    const source = (await resolveWorkspacePath(cwd, file.path)).path;
    const info = await lstat(source);
    if (!info.isFile() || info.size < 256) invalid("Tệp video nguồn bị thiếu hoặc quá nhỏ", 409);
    sources.push(source);
  }
  const ffmpeg = await createWorkspaceFfmpeg(cwd);
  // Validate actual video streams, not generated metadata or poster files.
  const probes = await Promise.all(sources.map(source => new Promise<{
    codec: string; width: number; height: number; hasAudio: boolean;
    fps?: string; pixelFormat?: string; audioCodec?: string; audioSampleRate?: string;
  }>((resolve, reject) => {
    ffmpeg.ffprobe(source, (error, data) => {
      if (error) return reject(error);
      const video = data.streams?.find(stream => stream.codec_type === "video");
      if (!video?.codec_name || !video.width || !video.height || data.format?.duration === undefined || Number(data.format.duration) <= 0)
        return reject(new Error("FFprobe không xác minh được luồng video, kích thước và thời lượng"));
      const audio = data.streams.find(stream => stream.codec_type === "audio");
      resolve({ codec: video.codec_name, width: video.width, height: video.height, hasAudio: !!audio,
        fps: video.avg_frame_rate, pixelFormat: video.pix_fmt,
        audioCodec: audio?.codec_name, audioSampleRate: audio?.sample_rate === undefined ? undefined : String(audio.sample_rate) });
    });
  })));
  if (!areConcatStreamsCompatible(probes))
    invalid("Các cảnh chưa tương thích codec/độ phân giải/âm thanh; cần chuẩn hóa trước khi ghép", 409);
  const manifest = (await resolveWorkspacePath(cwd, `batchJobs/${id}-concat.txt`, true)).path;
  // Explicit filenames are taken only from workspace-validated, existing files.
  const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
  await writeWorkspaceFile(manifest, sources.map(source => "file " + quote(source)).join("\n") + "\n");
  const outputName = `batchResults/${id}/joined-${randomUUID()}.mp4`;
  const output = (await resolveWorkspacePath(cwd, outputName, true)).path;
  await mkdir(dirname(output), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    ffmpeg().input(manifest).inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy", "-movflags +faststart"])
      .output(output).once("end", () => resolve()).once("error", reject).run();
  });
  const result = await lstat(output);
  if (!result.isFile() || result.size < 256) invalid("FFmpeg không tạo video MP4 hợp lệ", 409);
  await new Promise<void>((resolve, reject) => {
    ffmpeg.ffprobe(output, (error, data) => {
      if (error) return reject(error);
      if (!data.streams?.some(stream => stream.codec_type === "video") || Number(data.format?.duration) <= 0)
        return reject(new Error("Video ghép không có luồng video/thời lượng hợp lệ"));
      resolve();
    });
  });
  const merged = { path: outputName, mimeType: "video/mp4" as const };
  return mutateBatch(cwd, id, owner, current => {
    if (current.kind !== "video" || current.scenes.some(scene => scene.state !== "succeeded"))
      invalid("Trạng thái batch đã thay đổi trong lúc ghép", 409);
    current.merged ??= merged;
    return current.merged;
  });
}
