import { z } from "zod";
import { readFile } from "@toonflow/file";
import { parseSessionEntries, SessionManager } from "@earendil-works/pi-coding-agent";
import type { FileEntry } from "@earendil-works/pi-coding-agent";
import { getActiveAgentSession, getSubAgentInfo } from "@/agent/runtime/sessions";
import type { AgentSubAgent } from "@/agent/runtime/types";
import { thinkingLevels, type ThinkingLevel } from "@/lib/modelReasoning";
import { resolveWorkspacePath } from "@/utils/workspace/files";

const fileSchema = z.string().regex(/^[\w-]+\.jsonl$/, "Định danh phiên Agent không hợp lệ");
const memberSchema = z.object({
  file: fileSchema,
  parentFile: fileSchema,
  name: z.string().min(1),
  task: z.string(),
  status: z.enum(["running", "completed", "error", "limited", "cancelled", "inputRequired"]),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  thinkingLevel: z.enum(thinkingLevels).optional(),
});
const headerSchema = z.object({ type: z.literal("session"), parentSession: fileSchema.optional() });
const entrySchema = z.object({ type: z.string(), id: z.string().min(1), parentId: z.string().nullable(), timestamp: z.string() });

export type AgentTeamMember = {
  file: string;
  parentFile?: string;
  name: string;
  task?: string;
  status: AgentSubAgent["status"] | "idle";
  providerId?: string;
  modelId?: string;
  thinkingLevel?: ThinkingLevel;
};

export async function getAgentTeam(cwd: string, file: string): Promise<{ selfFile: string; rootFile: string; members: AgentTeamMember[] }> {
  // ACT: 沿会话树读取成员，开销与团队历史总量成正比；成员很多时再维护独立索引。
  fileSchema.parse(file);

  async function readSession(currentFile: string) {
    fileSchema.parse(currentFile);
    const { path } = await resolveWorkspacePath(cwd, `.agent/sessions/${currentFile}`);
    const active = getActiveAgentSession(path);
    let entries: FileEntry[];
    if (active) {
      entries = [active.history.getHeader()!, ...active.history.getEntries()];
    } else {
      const content = await readFile(path, "utf8");
      entries = parseSessionEntries(content);
      // ACT: SDK 会跳过坏行；成员授权不能根据缺损的会话关系继续判断。
      if (entries.length !== content.split("\n").filter(line => line.trim()).length) throw new Error("Lịch sử phiên Agent bị hỏng");
    }
    const header = headerSchema.parse(entries[0]);
    const ids = new Set<string>();
    for (const entry of entries.slice(1)) {
      const parsed = entrySchema.parse(entry);
      if (parsed.type === "session" || ids.has(parsed.id) || (parsed.parentId !== null && !ids.has(parsed.parentId))) {
        throw new Error("Cấu trúc lịch sử phiên Agent không hợp lệ");
      }
      ids.add(parsed.id);
    }
    const history = SessionManager.inMemory(cwd, undefined, entries);
    const infoEntry = getSubAgentInfo(history);
    const info = infoEntry ? memberSchema.parse(infoEntry.data) : undefined;
    if (Boolean(header.parentSession) !== Boolean(info) || (info && (info.file !== currentFile || info.parentFile !== header.parentSession))) {
      throw new Error("Phiên Agent con có thông tin sở hữu không nhất quán");
    }
    const children = new Map<string, z.infer<typeof memberSchema>>();
    for (const entry of history.getEntries()) {
      if (entry.type !== "custom" || entry.customType !== "toonflowSubAgent") continue;
      const child = memberSchema.parse(entry.data);
      if (child.parentFile !== currentFile) throw new Error("Bản ghi phiên cha của Agent con không nhất quán");
      children.set(child.file, child);
    }
    return { file: currentFile, path, history, info, parentFile: header.parentSession, children };
  }

  const snapshots = new Map<string, Awaited<ReturnType<typeof readSession>>>();
  async function getSession(currentFile: string) {
    const existing = snapshots.get(currentFile);
    if (existing) return existing;
    const session = await readSession(currentFile);
    snapshots.set(currentFile, session);
    return session;
  }

  let root = await getSession(file);
  const ancestors = new Set<string>();
  while (root.parentFile) {
    if (ancestors.has(root.file)) throw new Error("Quan hệ phiên cha của Agent tạo thành vòng lặp");
    ancestors.add(root.file);
    const parent = await getSession(root.parentFile);
    if (!parent.children.has(root.file)) throw new Error("Agent con chưa được đăng ký trong phiên cha");
    root = parent;
  }

  const members: AgentTeamMember[] = [];
  const pending: { file: string; parentFile?: string; record?: z.infer<typeof memberSchema> }[] = [{ file: root.file }];
  const visited = new Set<string>();
  for (let index = 0; index < pending.length; index++) {
    const item = pending[index]!;
    if (visited.has(item.file)) throw new Error("Quan hệ phiên Agent con tạo thành vòng lặp hoặc bị đăng ký trùng");
    visited.add(item.file);
    const session = await getSession(item.file).catch((error: NodeJS.ErrnoException) => {
      if (item.parentFile && error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!session) continue;
    if (session.parentFile !== item.parentFile) throw new Error("Agent con không thuộc cây phiên hiện tại");
    const context = session.history.buildSessionContext();
    const reasoning = session.history.getBranch().findLast(entry => entry.type === "custom" && entry.customType === "toonflowReasoning");
    const selection = z.object({ thinkingLevel: z.enum(thinkingLevels).nullable() }).safeParse(reasoning?.type === "custom" ? reasoning.data : undefined);
    const record = item.record ?? session.info;
    const status = getActiveAgentSession(session.path) ? "running" : record?.status === "running" ? "cancelled" : record?.status ?? "idle";
    members.push({
      file: session.file,
      parentFile: session.parentFile,
      name: session.history.getSessionName() || record?.name || "Agent chính",
      task: record?.task,
      status,
      providerId: context.model?.provider ?? record?.providerId,
      modelId: context.model?.modelId ?? record?.modelId,
      thinkingLevel: selection.success ? selection.data.thinkingLevel ?? undefined : z.enum(thinkingLevels).optional().parse(context.thinkingLevel ?? record?.thinkingLevel),
    });
    for (const child of session.children.values()) pending.push({ file: child.file, parentFile: session.file, record: child });
  }
  if (!members.some(member => member.file === file)) throw new Error("Agent hiện tại không thuộc cây phiên này");
  return { selfFile: file, rootFile: root.file, members };
}
