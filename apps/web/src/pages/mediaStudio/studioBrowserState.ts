import { z } from "@toonflow/nodes-scaffold/nodeTools";

const id = z.uuid();
const assetPath = z.string().min(1).max(2048).refine(path => !/^[\\/]|[:\u0000-\u001f]/.test(path)
  && path.split(/[\\/]/).every(part => part && part !== "." && part !== ".."));
const mediaReference = z.object({ path: assetPath, mimeType: z.string().regex(/^image\/[a-z0-9.+-]+$/i) });
const draft = z.object({
  prompt: z.string().max(100000), modelKey: z.string().max(1024), ratio: z.string().max(32), size: z.string().max(64),
  duration: z.union([z.number().finite(), z.literal("")]), resolution: z.string().max(64), selectedTaskId: z.union([id, z.literal("")]),
  references: z.array(mediaReference.extend({ name: z.string().max(300), digest: z.string().regex(/^[\da-f]{64}$/), bytes: z.number().int().positive() })).max(64),
});
const request = z.object({
  providerId: z.string().max(96), modelId: z.string().max(256), prompt: z.string().max(100000),
  ratio: z.string().optional(), size: z.string().optional(), duration: z.number().optional(), resolution: z.string().optional(),
  images: z.array(mediaReference).max(64).optional(), firstFrame: mediaReference.optional(), mode: z.union([z.string(), z.array(z.string())]).optional(),
});
const attempt = z.object({
  taskId: id, createdAt: z.number(), request: request.optional(), previousTaskId: id.optional(), failure: z.string().max(1000).optional(),
});
const entries = z.array(attempt);
export type StudioDraft = z.infer<typeof draft>;
export type StudioSubmission = z.infer<typeof request>;
export type StudioAttempt = z.infer<typeof attempt>;

function read(key: string) {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") as unknown; }
  catch { return null; }
}

export function readStudioDraft(key: string) {
  const parsed = draft.safeParse(read(key));
  return parsed.success ? parsed.data : undefined;
}
export function readStudioAttempts(key: string, scope?: { directory: string; kind: "image" | "video"; ownerId: string }) {
  const parsed = entries.safeParse(read(key));
  const saved = parsed.success ? parsed.data : [];
  if (!scope) return saved;
  try {
    const legacy = JSON.parse(sessionStorage.getItem("macflow.mediaStudio.pending.v1") ?? "[]");
    if (!Array.isArray(legacy)) return saved;
    for (const row of legacy) {
      if (row?.directory !== scope.directory || row.kind !== scope.kind || row.ownerId !== scope.ownerId) continue;
      const validated = attempt.safeParse({ taskId: row.taskId, createdAt: row.createdAt });
      if (validated.success && !saved.some(item => item.taskId === row.taskId)) saved.push(validated.data);
    }
  } catch { /* Vẫn mở được lịch sử trên máy chủ. */ }
  return saved.slice(-20);
}
export function saveStudioBrowserState(key: string, data: StudioDraft | StudioAttempt[]) {
  localStorage.setItem(key, JSON.stringify(data));
}
