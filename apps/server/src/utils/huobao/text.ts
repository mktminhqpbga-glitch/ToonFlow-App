import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { AssistantMessage, Context, Message } from "@earendil-works/pi-ai";
import { z } from "zod";
import u from "@/utils";

const toolsSchema = z.object({
  type: z.literal("function"),
  function: z.object({ name: z.string().min(1).max(64), description: z.string().max(10000).optional(),
    parameters: z.record(z.string(), z.json()).optional() }),
});
const callSchema = z.object({ id: z.string().max(256), function: z.object({ name: z.string().max(64), arguments: z.string().max(500000) }) });
const messageSchema = z.object({
  role: z.enum(["system", "developer", "user", "assistant", "tool"]),
  content: z.union([z.string().max(1000000), z.array(z.object({ type: z.literal("text"), text: z.string().max(1000000) })).max(100), z.null()]).optional(),
  tool_call_id: z.string().max(256).optional(), tool_calls: z.array(callSchema).max(32).optional(),
});

export async function generateText(req: Request, res: Response, selection: { providerId: string; modelId: string }, alias: string) {
  const input = z.object({ model: z.literal(alias), messages: z.array(messageSchema).min(1).max(300),
    tools: z.array(toolsSchema).max(32).optional(), stream: z.boolean().optional() }).parse(req.body);
  if (Buffer.byteLength(JSON.stringify(input)) > 8 * 1024 * 1024) throw Object.assign(new Error("Ngữ cảnh Huobao vượt 8 MiB."), { status: 413 });
  const model = await u.ai.getConfiguredModel(selection.providerId, selection.modelId);
  const names = new Map<string, string>();
  const system: string[] = [];
  const messages: Message[] = [];
  const timestamp = Date.now();
  for (const message of input.messages) {
    const text = Array.isArray(message.content) ? message.content.map(part => part.text).join("\n") : message.content ?? "";
    if (message.role === "system" || message.role === "developer") system.push(text);
    else if (message.role === "user") messages.push({ role: "user", content: text, timestamp });
    else if (message.role === "assistant") {
      const parts: AssistantMessage["content"] = text ? [{ type: "text", text }] : [];
      for (const call of message.tool_calls ?? []) {
        names.set(call.id, call.function.name);
        parts.push({ type: "toolCall", id: call.id, name: call.function.name,
          arguments: z.record(z.string(), z.json()).parse(JSON.parse(call.function.arguments)) });
      }
      messages.push({ role: "assistant", content: parts, timestamp, api: model.provider.protocol, provider: "toonflow", model: selection.modelId,
        stopReason: message.tool_calls?.length ? "toolUse" : "stop",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } });
    } else {
      const toolCallId = z.string().min(1).parse(message.tool_call_id);
      const toolName = names.get(toolCallId);
      if (!toolName) throw Object.assign(new Error("Huobao gửi kết quả công cụ thiếu lượt gọi tương ứng."), { status: 400 });
      messages.push({ role: "toolResult", toolCallId, toolName, timestamp, content: [{ type: "text", text }], isError: false });
    }
  }
  const context: Context = { systemPrompt: system.join("\n\n"), messages,
    tools: input.tools?.map(({ function: tool }) => ({
      name: tool.name, description: tool.description ?? tool.name,
      parameters: tool.parameters ?? { type: "object", properties: {} },
    })) };
  const cancellation = new AbortController();
  const abort = () => cancellation.abort();
  res.once("close", abort);
  const id = `chatcmpl-${randomUUID()}`;
  const meta = { id, created: Math.floor(timestamp / 1000), model: alias };
  const send = (delta: object, finish: string | null = null, usage?: object) => {
    if (!res.destroyed) res.write(`data: ${JSON.stringify({ ...meta, object: "chat.completion.chunk",
      choices: [{ index: 0, delta, finish_reason: finish }], ...(usage && { usage }) })}\n\n`);
  };
  try {
    const stream = u.ai.streamAi(model, context, AbortSignal.any([cancellation.signal, AbortSignal.timeout(180000)]));
    if (input.stream) {
      res.set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" });
      res.flushHeaders();
      send({ role: "assistant" });
    }
    for await (const event of stream) {
      if (input.stream && event.type === "text_delta") send({ content: event.delta });
    }
    const message = await stream.result();
    if (["error", "aborted"].includes(message.stopReason)) throw new Error("Mô hình văn bản MacFlow không hoàn tất yêu cầu.");
    const text = message.content.flatMap(part => part.type === "text" ? [part.text] : []).join("");
    const calls = message.content.flatMap(part => part.type === "toolCall" ? [{
      id: part.id, type: "function" as const, function: { name: part.name, arguments: JSON.stringify(part.arguments) },
    }] : []);
    const finish = calls.length ? "tool_calls" : message.stopReason === "length" ? "length" : "stop";
    const usage = { prompt_tokens: message.usage.input + message.usage.cacheRead, completion_tokens: message.usage.output, total_tokens: message.usage.totalTokens };
    if (input.stream) {
      if (calls.length) send({ tool_calls: calls.map((call, index) => ({ ...call, index })) });
      send({}, finish, usage);
      if (!res.destroyed) res.end("data: [DONE]\n\n");
    } else {
      res.json({ ...meta, object: "chat.completion", usage, choices: [{ index: 0, finish_reason: finish,
        message: { role: "assistant", content: text || null, ...(calls.length && { tool_calls: calls }) } }] });
    }
  } catch (cause) {
    if (!res.headersSent) throw cause;
    if (!res.destroyed) res.end(`data: ${JSON.stringify({ error: { message: "Mô hình MacFlow không hoàn tất yêu cầu." } })}\n\n`);
  } finally { res.off("close", abort); }
}
