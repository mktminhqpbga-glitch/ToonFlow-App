import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { mkdir, readdir, readFile, realpath } from "@toonflow/file";
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
  state: sceneState,
  request: z.union([imageGenerationSchema, videoGenerationSchema]),
  result: z.array(z.object({ path: z.string(), mimeType: z.string(), mediaType: kindSchema })).optional(),
  error: z.string().max(2000).optional(),
});
const batchSchema = z.object({
  version: z.literal(1), id: z.uuid(), kind: kindSchema, ownerUserId: z.uuid().optional(),
  state: batchState, createdAt: z.number().int(), updatedAt: z.number().int(),
  scenes: z.array(sceneSchema).min(1).max(100),
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
  const [task] = await mediaTasks.status(cwd, [scene.taskId], false, owner);
  if (!task || task.state === "running") return "running" as const;
  if (task.state === "succeeded" && task.result?.data?.length) {
    await mutateBatch(cwd, id, owner, record => {
      const current = record.scenes[index];
      if (current?.state === "running") { current.state = "succeeded"; current.result = task.result!.data!; }
    });
    return "succeeded" as const;
  }
  if (task.state === "failed" || task.state === "cancelled") {
    await mutateBatch(cwd, id, owner, record => {
      const current = record.scenes[index];
      if (current?.state === "running") {
        current.state = task.state === "cancelled" ? "cancelled" : "failed";
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
    const next = batch.scenes.find(scene => scene.state === "queued");
    if (!next) {
      await mutateBatch(cwd, id, owner, current => {
        if (current.state === "running") current.state = "completed";
      });
      return;
    }
    // Persist the generated task ID and RUNNING state before any provider-side submission.
    await mutateBatch(cwd, id, owner, current => {
      const scene = current.scenes[next.index];
      if (current.state === "running" && scene?.state === "queued") scene.state = "running";
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
  return batches.sort((a, b) => b.createdAt - a.createdAt);
}
export async function controlBatch(cwd: string, id: string, action: "pause" | "resume" | "cancel", owner?: AuthIdentity | null) {
  cwd = await realpath(cwd);
  const state = await mutateBatch(cwd, id, owner, batch => {
    if (action === "pause" && batch.state === "running") batch.state = "paused";
    if (action === "resume" && batch.state === "paused") batch.state = "running";
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
