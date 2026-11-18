import { z } from "zod";
import type { ToolPlugin } from "@toonflow/tools-scaffold/runtime";
import { sandboxRequestSchema } from "./schema";

const configSchema = z.object({}).strict();

const plugin: ToolPlugin = {
  validateConfig: config => configSchema.parse(config),
  createTools({ config, sandbox }) {
    configSchema.parse(config);
    if (!sandbox) return [];
    return [{
      name: "sandbox",
      label: "Sandbox mã",
      description: "Chạy Bash, JavaScript (js-exec) và Python (python3) trong filesystem bộ nhớ cô lập, thư mục /workspace. Dùng files tạo tệp chữ hoặc imports lấy tệp cần thiết; chỉ khi chạy thành công mới dùng exports ghi lại vào workspace, mặc định không ghi đè. Trả mã thoát và đầu ra. Không có mạng, JavaScript không hỗ trợ đầy đủ Node.js, Python không có pip hoặc chương trình máy chủ.",
      promptSnippet: "Chạy script JS/Python của kỹ năng trong bộ nhớ cô lập và chủ động import/export tệp.",
      promptGuidelines: [
        "Trước khi chạy mã đi kèm kỹ năng, đọc hướng dẫn để xác định script, tệp đầu vào và phụ thuộc. Dùng imports nhập tệp cần thiết; sandbox không tự đọc file bên cạnh script.",
        "Chạy bằng js-exec script.js hoặc python3 script.py; nếu JS có import/export thì dùng js-exec -m script.js. fs API chỉ vào filesystem ảo. Tổng tệp import/export tối đa 16 MiB mỗi chiều, kết quả văn bản tối đa 64 KiB.",
        "Mỗi lượt là /workspace mới. Muốn giữ kết quả phải khai báo exports; lần sau nhập lại bằng imports. Trước khi ghi đè tệp workspace, xác nhận ý người dùng và đặt overwrite=true rõ ràng.",
        "JavaScript dùng QuickJS, Python chỉ có thư viện tiêu chuẩn đi kèm; không có Node.js đầy đủ, pip, chương trình cục bộ hay mạng. Nếu thiếu phụ thuộc, nêu giới hạn; không coi sandbox chạy được là kỹ năng đã được kiểm chứng hoàn toàn.",
      ],
      parameters: z.toJSONSchema(sandboxRequestSchema, { io: "input", target: "draft-07" }),
      executionMode: "sequential",
      execute(id, params, signal, onUpdate, context) {
        signal?.throwIfAborted();
        return sandbox.execute(id, sandboxRequestSchema.parse(params), signal, onUpdate, context);
      },
    }];
  },
};

export default plugin;
