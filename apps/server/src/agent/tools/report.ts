import { z } from "zod";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { reportToParent } from "@/agent/runtime/sessions";
import type { AgentEvent } from "@/agent/runtime/types";

export function createReportTool(cwd: string, parentFile: string, file: string, name: string, send: (event: AgentEvent) => void): ToolDefinition {
  const parameters = z.strictObject({ content: z.string().trim().min(1).max(16000).describe("Kết luận, tiến độ hoặc vấn đề cần Agent cha điều phối") });
  return {
    name: "report", label: "Báo cáo Agent cha",
    description: "Gửi tiến độ quan trọng hoặc kết luận cuối của tác vụ con cho Agent cha. Báo cáo được đưa vào ngữ cảnh Agent cha, không thay thế trao đổi trực tiếp với người dùng và không tự khởi chạy Agent cha đang rảnh.",
    promptGuidelines: ["Khi hoàn thành tác vụ được giao hoặc gặp vấn đề cần Agent cha phối hợp, hãy dùng report báo cáo kết luận, thay đổi, kiểm chứng và phần chưa xong."],
    parameters: z.toJSONSchema(parameters), executionMode: "sequential",
    async execute(_id, params, signal) {
      signal?.throwIfAborted();
      const { content } = parameters.parse(params);
      const id = await reportToParent(cwd, parentFile, file, name, content);
      send({ type: "report", id, parentFile, file, name, content });
      return { content: [{ type: "text", text: "Đã gửi báo cáo cho Agent cha" }], details: { id } };
    },
  };
}
