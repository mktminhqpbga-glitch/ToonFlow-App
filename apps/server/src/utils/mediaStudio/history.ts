import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { lstat, readdir, readFile, realpath } from "@toonflow/file";
import type { AuthIdentity } from "@toonflow/multi-tenant-auth";
import { z } from "zod";
import conf from "@/utils/conf";
import { modelGateway } from "@/utils/multiTenant/gateway";
import { resolveWorkspacePath } from "@/utils/workspace/files";

const mediaTypeSchema = z.enum(["image", "video"]);
const fileSchema = z.object({
  path: z.string().min(1).max(4096).refine(path => !/^[\\/]|[:\u0000-\u001f]/.test(path)
    && path.split(/[\\/]/).every(part => part && part !== "." && part !== "..")),
  mimeType: z.string().regex(/^(?:image|video)\/[a-z0-9.+-]+$/i),
  mediaType: mediaTypeSchema,
});
const taskSchema = z.object({
  taskId: z.uuid(), cwd: z.string(), ownerUserId: z.uuid().optional(),
  mediaType: z.enum(["image", "video", "audio"]).optional(),
  state: z.enum(["running", "interrupted", "succeeded", "failed", "cancelled"]),
  createdAt: z.number(), updatedAt: z.number(),
  request: z.object({ providerId: z.string(), modelId: z.string(), prompt: z.string() }).optional(),
  result: z.object({ code: z.number(), message: z.string(), data: z.array(fileSchema).nullable() }).optional(),
  checkpoint: z.object({
    files: z.array(fileSchema.extend({ hash: z.string().regex(/^[a-f0-9]{64}$/) })).optional(),
    providerData: z.unknown().optional(), assets: z.array(z.unknown()).optional(), assetCount: z.number().optional(),
  }).optional(),
});

type StudioTask = z.infer<typeof taskSchema>;
export type StudioTaskEntry = {
  taskId: string;
  mediaType: "image" | "video";
  state: StudioTask["state"];
  createdAt: number;
  updatedAt: number;
  providerId?: string;
  modelId?: string;
  prompt?: string;
  resumable: boolean;
  result?: { code: number; message: string; data: z.infer<typeof fileSchema>[] | null };
};

function allowedOwner(task: StudioTask, owner?: AuthIdentity | null) {
  if (owner?.role === "admin") return true;
  if (owner?.role === "user") return task.ownerUserId === owner.id;
  return task.ownerUserId === undefined;
}

function requireIdentity(owner?: AuthIdentity | null) {
  if (modelGateway.enabled() && !owner) throw Object.assign(new Error("Vui lòng đăng nhập để xem lịch sử media."), { status: 401 });
}

function taskDirectory(directory: string) {
  const key = process.platform === "win32" ? directory.toLowerCase() : directory;
  return join(dirname(conf.path), "mediaTasks", `workspace${createHash("sha256").update(key).digest("hex")}`);
}

async function readTaskRecord(directory: string, path: string, owner?: AuthIdentity | null) {
  const info = await lstat(path).catch((cause: NodeJS.ErrnoException) => {
    if (cause.code === "ENOENT") return undefined;
    throw cause;
  });
  if (!info?.isFile() || info.isSymbolicLink() || info.size <= 0 || info.size > 16 * 1024 * 1024) return undefined;
  let raw: unknown;
  try { raw = JSON.parse(await readFile(path, "utf8")); }
  catch (cause) { if (cause instanceof SyntaxError) return undefined; throw cause; }
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const task = parsed.data;
  if ((process.platform === "win32" ? task.cwd.toLowerCase() : task.cwd) !== (process.platform === "win32" ? directory.toLowerCase() : directory)
    || !allowedOwner(task, owner)) return undefined;
  const expectedName = `task${task.taskId.replaceAll("-", "").toLowerCase()}.json`;
  if (!path.endsWith(`/${expectedName}`) && !path.endsWith(`\\${expectedName}`)) return undefined;
  return task;
}

async function hasCompleteFiles(task: StudioTask) {
  const checkpoint = task.checkpoint;
  if (!checkpoint?.assetCount || checkpoint.files?.length !== checkpoint.assetCount) return false;
  for (const file of checkpoint.files) {
    const resolved = await resolveWorkspacePath(task.cwd, file.path).catch(() => undefined);
    if (!resolved) return false;
    const info = await lstat(resolved.path).catch((cause: NodeJS.ErrnoException) => {
      if (cause.code === "ENOENT") return undefined;
      throw cause;
    });
    if (!info?.isFile() || info.isSymbolicLink()) return false;
  }
  return true;
}

async function taskSummary(task: StudioTask): Promise<StudioTaskEntry> {
  const checkpoint = task.checkpoint;
  const resumable = (task.state === "running" || task.state === "interrupted")
    && (task.request?.providerId !== "aiChrome" && (!!checkpoint?.providerData || !!checkpoint?.assets?.length)
      || await hasCompleteFiles(task));
  return {
    taskId: task.taskId, mediaType: task.mediaType as "image" | "video", state: task.state,
    createdAt: task.createdAt, updatedAt: task.updatedAt,
    providerId: task.request?.providerId, modelId: task.request?.modelId,
    prompt: task.request?.prompt, resumable,
    ...(task.result ? { result: { code: task.result.code, message: task.result.message,
      data: task.result.data?.filter(file => file.mediaType === task.mediaType) ?? null } } : {}),
  };
}

export async function findStudioTask(directory: string, taskId: string, owner?: AuthIdentity | null) {
  requireIdentity(owner);
  const canonical = await realpath(directory);
  const normalized = z.uuid().parse(taskId).replaceAll("-", "").toLowerCase();
  const task = await readTaskRecord(canonical, join(taskDirectory(canonical), `task${normalized}.json`), owner);
  if (!task || !mediaTypeSchema.safeParse(task.mediaType).success)
    throw Object.assign(new Error("Không tìm thấy tác vụ trong xưởng media của dự án."), { status: 404 });
  return taskSummary(task);
}

export async function listStudioHistory(directory: string, owner?: AuthIdentity | null, options: {
  mediaType?: "image" | "video";
  limit?: number;
  offset?: number;
} = {}) {
  requireIdentity(owner);
  const canonical = await realpath(directory);
  const root = taskDirectory(canonical);
  const rootInfo = await lstat(root).catch((cause: NodeJS.ErrnoException) => {
    if (cause.code === "ENOENT") return undefined;
    throw cause;
  });
  if (!rootInfo) return { entries: [], hasMore: false };
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink())
    throw Object.assign(new Error("Thư mục lịch sử tác vụ không hợp lệ."), { status: 409 });
  const taskFiles = await readdir(root, { withFileTypes: true });
  const candidates = await Promise.all(taskFiles.filter(entry => entry.isFile() && /^task[a-f0-9]{32}\.json$/.test(entry.name))
    .map(async entry => ({ name: entry.name, updatedAt: (await lstat(join(root, entry.name))).mtimeMs })));
  candidates.sort((left, right) => right.updatedAt - left.updatedAt);
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const entries: StudioTaskEntry[] = [];
  let matched = 0;
  let hasMore = false;
  for (const file of candidates) {
    // 只读取私有已存在的任务元数据；不会恢复或重新发起 AI 请求。
    const record = await readTaskRecord(canonical, join(root, file.name), owner);
    if (!record || !mediaTypeSchema.safeParse(record.mediaType).success
      || options.mediaType && record.mediaType !== options.mediaType) continue;
    if (matched++ < offset) continue;
    if (entries.length < limit) entries.push(await taskSummary(record));
    else { hasMore = true; break; }
  }
  return { entries, hasMore };
}
