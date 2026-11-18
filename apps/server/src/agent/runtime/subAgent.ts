import type { Usage } from "@earendil-works/pi-ai";
import { createAgentSession, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import type { AgentSession, CreateAgentSessionOptions, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { ToolCall } from "@toonflow/tools-scaffold/runtime";
import { createAgentResources } from "@/agent/runtime/resources";
import { configureAgentRequests } from "@/agent/runtime/requests";

export type SubAgentModel = Pick<CreateAgentSessionOptions, "modelRuntime" | "model" | "thinkingLevel">;
export type SubAgentResult = {
  name: string;
  file?: string;
  status: "running" | "completed" | "error" | "limited" | "cancelled" | "inputRequired";
  result: string;
  taskId?: string;
  contextId?: string;
};

export function emptyUsage(): Usage {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
}

export function addUsage(total: Usage, value: Usage) {
  for (const key of ["input", "output", "cacheRead", "cacheWrite", "totalTokens"] as const) total[key] += value[key];
  for (const key of ["input", "output", "cacheRead", "cacheWrite", "total"] as const) total.cost[key] += value.cost[key];
}

export async function runSubAgent(options: SubAgentModel & {
  cwd: string;
  name: string;
  task: string;
  tools: ToolDefinition[];
  instructions?: string;
  signal?: AbortSignal;
  history?: SessionManager;
  inputRequired?: () => string | undefined;
  onTool?: (tool: ToolCall) => void;
  onProgress?: (message: string) => void;
}) {
  const { cwd, name, task, tools, instructions, signal = new AbortController().signal, history, inputRequired, onTool, onProgress, ...modelOptions } = options;
  const result: SubAgentResult = { name, status: "running", result: "Chuẩn bị thực hiện" };
  const usage = emptyUsage();
  let session: AgentSession | undefined;
  const abort = () => { void session?.abort(); };
  signal.addEventListener("abort", abort, { once: true });
  // A2A 继续任务复用内存历史；只汇总本次新增记录，避免重复计费。
  const previousEntries = history?.getEntries().length ?? 0;
  try {
    signal.throwIfAborted();
    const activeTools = tools.map(tool => ({
      ...tool,
      async execute(...args: Parameters<ToolDefinition["execute"]>) {
        const toolSignal = args[2] ? AbortSignal.any([signal, args[2]]) : signal;
        toolSignal.throwIfAborted();
        // ACT: SDK 在整批工具结束后才停轮；提出问题后不再执行本批后续操作。
        if (inputRequired?.()) throw new Error("Tác vụ đang chờ bên giao việc bổ sung thông tin, không thể tiếp tục gọi công cụ");
        if (tool.name !== "askUser" || !onTool) return tool.execute(args[0], args[1], toolSignal, args[3], args[4]);
        // 子会话的模型调用 ID 可能重复，提问卡片与回答通道使用独立 ID。
        const id = crypto.randomUUID();
        onTool({ id, name: tool.name, args: args[1] as Record<string, unknown>, status: "running" });
        try {
          const output = await tool.execute(id, args[1], toolSignal, args[3], args[4]);
          onTool({ id, name: tool.name, status: "success", result: output.content.filter(part => part.type === "text").map(part => part.text).join("\n") });
          return output;
        } catch (error) {
          onTool({ id, name: tool.name, status: signal.aborted ? "interrupted" : "error", result: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      },
    }));
    const resources = await createAgentResources(cwd, activeTools, SettingsManager.inMemory({
      compaction: { enabled: false },
      // 复用 SDK 的轮次重试，覆盖响应头之后的断流；不叠加供应商层重试。
      retry: { enabled: true, maxRetries: 3, baseDelayMs: 2000, provider: { maxRetries: 0 } },
    }), instructions);
    signal.throwIfAborted();
    ({ session } = await createAgentSession({
      ...modelOptions, ...resources, cwd,
      sessionManager: history ?? SessionManager.inMemory(cwd),
      customTools: activeTools,
      tools: activeTools.map(tool => tool.name),
    }));
    configureAgentRequests(session, undefined, signal);
    signal.throwIfAborted();
    session.agent.shouldStopAfterTurn = () => Boolean(inputRequired?.());
    session.subscribe(event => {
      if (signal.aborted) return;
      if (event.type === "message_start" && event.message.role === "assistant") onProgress?.("Đang xử lý");
      if (event.type === "tool_execution_start") onProgress?.(`Đang gọi ${event.toolName}`);
    });
    await session.prompt(`Bạn đang thực hiện một tác vụ độc lập được giao. Chỉ xử lý tác vụ bên dưới và tuân thủ các quy tắc về quyền hạn và workspace trong hệ thống. Nếu thiếu thông tin hoặc chưa được cấp quyền, hãy nêu trở ngại và chuyển lại cho bên giao việc; nếu có requestInput, hãy dùng để chờ bổ sung. Kết thúc bằng kết luận ngắn gọn, đường dẫn tương đối của những tệp đã sửa thật, kết quả xác minh và việc còn dang dở; nội dung dài phải được ghi vào tệp trong workspace đã được cho phép.\n\n${JSON.stringify({ name, task })}`, { expandPromptTemplates: false });
    signal.throwIfAborted();
    const question = inputRequired?.();
    const reply = session.messages.findLast(message => message.role === "assistant");
    if (!reply || reply.role !== "assistant") throw new Error("Tác vụ con không trả lời");
    if (reply.stopReason === "error" || reply.stopReason === "aborted") throw new Error(reply.errorMessage || "Tác vụ con thực thi thất bại");
    const text = question ?? reply.content.filter(part => part.type === "text").map(part => part.text).join("\n").trim();
    if (!text) throw new Error("Tác vụ con không trả về văn bản");
    result.status = question ? "inputRequired" : reply.stopReason === "length" || text.length > 16000 ? "limited" : "completed";
    result.result = `${text.slice(0, 16000)}${text.length > 16000 ? "\n[Kết quả quá dài, đã cắt bớt; hãy đọc tệp kết quả trong workspace]" : ""}${reply.stopReason === "length" ? "\n[Đầu ra mô hình đạt giới hạn độ dài, tác vụ có thể chưa hoàn tất]" : ""}`.trim();
  } catch (error) {
    result.status = signal.aborted ? "cancelled" : "error";
    const reason = signal.aborted ? signal.reason : error;
    result.result = reason instanceof Error ? reason.message : "Tác vụ con thực thi thất bại";
  } finally {
    signal.removeEventListener("abort", abort);
    if (session) {
      try {
        await session.abort();
        for (const entry of session.sessionManager.getEntries().slice(previousEntries)) {
          if (entry.type === "message" && (entry.message.role === "assistant" || entry.message.role === "toolResult") && entry.message.usage) addUsage(usage, entry.message.usage);
        }
      } finally { session.dispose(); }
    }
  }
  return { result, usage };
}
