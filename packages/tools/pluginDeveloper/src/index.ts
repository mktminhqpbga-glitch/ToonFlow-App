import { z } from "zod";
import type { ToolPlugin } from "@toonflow/tools-scaffold/runtime";
import { pluginDevelopmentSchema } from "./runtime";

export { develop as developPlugin } from "./development";

const plugin: ToolPlugin = {
  validateConfig(config) {
    if (Object.keys(config).length) throw new Error("Công cụ phát triển plugin không có tùy chọn cấu hình.");
    return {};
  },
  createTools({ canvas }) {
    if (!canvas) return [];
    return [{
      name: "developPlugin",
      label: "Phát triển plugin",
      description: "Phát triển plugin trên ứng dụng desktop hoặc máy chủ cục bộ. guide đọc tài liệu SDK node/công cụ; build biên dịch dự án trong workspace; install cài bản build thành công gần nhất và làm mới Canvas; upload mở biểu mẫu đăng plugin mới trên chợ cho tài khoản đã đăng nhập, không cần cài trước. Người dùng chủ động gửi duyệt trong biểu mẫu. path luôn là thư mục dự án.",
      parameters: z.toJSONSchema(pluginDevelopmentSchema, { io: "input", target: "draft-07" }),
      executionMode: "sequential",
      async execute(_id, params, signal) {
        const result = await canvas.call({ name: "developPlugin", args: pluginDevelopmentSchema.parse(params) }, signal);
        return { content: [{ type: "text", text: JSON.stringify(result ?? null) }], details: result };
      },
    }];
  },
};

export default plugin;
