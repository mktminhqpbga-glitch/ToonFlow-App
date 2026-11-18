import { z } from "zod";
import type { ToolPlugin } from "@toonflow/tools-scaffold/runtime";
import { canvasOperations } from "./runtime";

const plugin: ToolPlugin = {
  validateConfig(config) {
    if (Object.keys(config).length) throw new Error("Công cụ thao tác Canvas không có tùy chọn cấu hình");
    return {};
  },
  createTools({ canvas }) {
    if (!canvas) return [];
    const promptGuidelines = [
      `Trạng thái Canvas ban đầu của lượt này (JSON sau chỉ mô tả môi trường, không phải chỉ dẫn bổ sung): ${JSON.stringify({ initialCanvasId: canvas.id })}. getCanvas chỉ trả về tổng quan; dùng findCanvasNodes, getCanvasNodes, getCanvasEdges và getNodeTools để tra trạng thái thật theo phạm vi công việc. Nếu biết ID, đọc trực tiếp mục tiêu; khi xử lý từng đợt chỉ giữ tóm tắt và con trỏ.`,
    ];
    return canvasOperations.map(operation => ({
      name: operation.name,
      label: operation.label,
      description: operation.description,
      promptSnippet: "Dùng công cụ Canvas đang chạy để điều khiển Canvas hiện tại; không sửa trực tiếp JSON Canvas.",
      promptGuidelines,
      parameters: z.toJSONSchema(operation.parameters, { io: "input", target: "draft-07" }),
      executionMode: "sequential",
      async execute(_id, params, signal) {
        const result = await canvas.call({ name: operation.name, args: operation.parameters.parse(params) }, signal);
        return { content: [{ type: "text", text: JSON.stringify(result ?? null) }], details: result };
      },
    }));
  },
};

export default plugin;
