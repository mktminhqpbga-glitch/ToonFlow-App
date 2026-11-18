import { z } from "zod";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { QuestionContext, QuestionRequest } from "@toonflow/tools-scaffold/runtime";
import { translateMessage } from "@/lib/i18n";
import { searchPluginMarketSchema, installMarketPluginSchema, searchPluginMarket, resolveMarketPlugin, installMarketPlugin } from "@/lib/pluginMarket";

export function createPluginMarketTools(question?: QuestionContext): ToolDefinition[] {
  return [{
    name: "searchPluginMarket", label: "Tìm trong chợ plugin",
    description: "Tìm trong chợ plugin Toonflow theo từ khóa hoặc loại và trả về ID mục có thể cài đặt.",
    parameters: z.toJSONSchema(searchPluginMarketSchema, { io: "input", target: "draft-07" }),
    async execute(_id, params, signal) {
      const details = await searchPluginMarket(params, signal);
      return { content: [{ type: "text", text: JSON.stringify(details) }], details };
    },
  }, {
    name: "installMarketPlugin", label: "Cài plugin từ chợ",
    description: "Yêu cầu cài một plugin theo ID trong kết quả tìm kiếm. Chỉ tải và cài sau khi người dùng xác nhận trong Toonflow. Nếu người dùng hủy, không được yêu cầu cài lại cùng plugin.",
    parameters: z.toJSONSchema(installMarketPluginSchema, { io: "input", target: "draft-07" }),
    executionMode: "sequential",
    async execute(toolCallId, params, signal) {
      if (!question) throw new Error("Vui lòng mở Toonflow trên máy hoặc trên web");
      const plugin = resolveMarketPlugin(params, signal);
      const types = { node: "节点", tool: "工具", skill: "技能", ext: "文件扩展", agent: "Agent" };
      const request: QuestionRequest & { requiresLocalApproval: true } = {
        requiresLocalApproval: true,
        title: translateMessage("安装插件"),
        question: [
          [translateMessage("插件市场"), translateMessage(types[plugin.type]), plugin.name, plugin.version].filter(Boolean).join(" · "),
          plugin.fileName,
          plugin.supplier && `${translateMessage("供应商")} · ${plugin.supplier}`,
          translateMessage("插件可能执行代码并访问本地文件，请仅安装信任来源的插件。"),
        ].filter(Boolean).join("\n"),
        fields: [{ field: "approved", title: translateMessage("确认安装"), type: "switch", required: true }],
      };
      const answer = await question.ask(toolCallId, request, signal);
      signal?.throwIfAborted();
      const details = !answer.skipped && answer.values?.approved === true
        ? { ...await installMarketPlugin(plugin, signal), installed: true }
        : { installed: false, reason: "userDeclined" };
      return { content: [{ type: "text", text: JSON.stringify(details) }], details };
    },
  }];
}
