import type { AssistantMessage, Context } from "@earendil-works/pi-ai";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { writeAtomic } from "@toonflow/file";
import { z } from "zod";
import conf from "@/utils/conf";
import { readAiReferences } from "@/utils/ai";
import { maxFileSize, readReferences, validateFile, type ReferenceFile } from "./files";
import { runTask, completeTask, failTask } from "./jobs";
import { providerForChromeModel } from "./protocol";

type Reference = { dataType: "STRING"; value: string } | { dataType: "IMAGE" | "VIDEO" | "FILE"; value: { url: string; mimeType: string } };
const responseSchema = z.strictObject({ text: z.string(), toolCalls: z.array(z.strictObject({ name: z.string(), arguments: z.record(z.string(), z.json()) })).max(32) });

export async function generateChromeText(input: { requestId?: string; modelId: string; chromeTabId?: number; context: Context; references?: Reference[]; directory?: string }, signal: AbortSignal): Promise<AssistantMessage & { usageKnown: false }> {
  if (!providerForChromeModel(input.modelId)) throw new Error("Model AI chrome không hợp lệ. Hãy chọn lại dịch vụ.");
  const id = input.requestId ?? randomUUID();
  const files: ReferenceFile[] = []; const referenceText: string[] = [];
  function appendFiles(values: ReferenceFile[]) {
    if (files.length + values.length > 8 || [...files, ...values].reduce((size, file) => size + file.bytes.byteLength, 0) > maxFileSize) throw new Error("Tối đa 8 tệp tham chiếu, tổng không quá 64 MB.");
    files.push(...values);
  }
  for (const [index, ref] of (input.references ?? []).entries()) {
    signal.throwIfAborted();
    const label = `{{ref ${index + 1}}}`;
    if (ref.dataType === "STRING") referenceText.push(`${label}\n${ref.value}`);
    else if (ref.dataType === "FILE") {
      const values = await readAiReferences(input.directory, [{ dataType: "FILE", value: ref.value }], signal);
      for (const value of values) if (value.dataType === "STRING") referenceText.push(`${label}\n${value.value}`);
    } else {
      if (!input.directory) throw new Error("Tệp tham chiếu cần workspace.");
      if (files.length >= 8) throw new Error("Tối đa 8 tệp tham chiếu.");
      appendFiles(await readReferences(input.directory, [{ path: ref.value.url, mimeType: ref.value.mimeType, label }], signal));
    }
  }
  // Only SDK image content is an attachment; image-shaped tool arguments/schemas stay intact.
  const contextText = JSON.stringify({
    ...input.context,
    messages: input.context.messages.map(message => ({
      ...message,
      content: typeof message.content === "string" ? message.content : message.content.map(part => {
        if (part.type !== "image") return part;
        signal.throwIfAborted();
        if (files.length >= 8 || part.data.length > 88 * 1024 * 1024) throw new Error("Quá nhiều ảnh hoặc ảnh ngữ cảnh quá lớn.");
        const bytes = Buffer.from(part.data, "base64");
        const mimeType = validateFile(bytes, part.mimeType, "image");
        const label = `Context attachment ${files.length + 1}`;
        appendFiles([{ bytes, mimeType, label }]);
        return { type: "image", attachment: label, mimeType };
      }),
    })),
  });
  const tools = input.context.tools ?? [];
  const toolInstruction = tools.length
    ? 'Return ONLY JSON with shape {"text":"response", "toolCalls":[{"name":"an available tool name", "arguments":{}}]}. Use an empty toolCalls array for the final answer. Match tool parameter schemas exactly. Tool calls are requests, not evidence that actions have already run. Existing host permissions and tool validation still apply.'
    : "Return the requested text response.";
  try {
    const result = await runTask({ id, kind: "text", modelId: input.modelId, tabId: input.chromeTabId, prompt: [contextText, ...referenceText].join("\n\n"), specification: { outputInstructions: toolInstruction }, files, save: async () => {} }, signal);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(result.bytes);
    let content: AssistantMessage["content"] = [{ type: "text", text }];
    if (tools.length) {
      const clean = text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      const response = responseSchema.parse(JSON.parse(clean));
      if (response.toolCalls.some(call => !tools.some(tool => tool.name === call.name))) throw new Error("AI chrome yêu cầu công cụ không có trong danh sách đã cấp.");
      content = [
        ...(response.text ? [{ type: "text" as const, text: response.text }] : []),
        ...response.toolCalls.map(call => ({ type: "toolCall" as const, id: `chrome_${randomUUID()}`, name: call.name, arguments: call.arguments })),
      ];
    }
    const message: AssistantMessage & { usageKnown: false } = {
      role: "assistant", api: "chrome", provider: "aiChrome", model: input.modelId, timestamp: Date.now(), content,
      stopReason: content.some(part => part.type === "toolCall") ? "toolUse" : "stop", usageKnown: false,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    };
    signal.throwIfAborted();
    await writeAtomic(join(dirname(conf.path), "aiChromeTasks", `${id}.response.json`), JSON.stringify(message), { mode: 0o600 });
    await completeTask(id);
    return message;
  } catch (error) { failTask(id, error); throw error; }
}
