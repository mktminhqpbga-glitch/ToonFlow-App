import { z } from "zod";

const requestSchema = z.object({
  action: z.enum(["list", "read", "create", "update", "mkdir", "move", "delete", "import"]),
  path: z.string().max(4096).optional().describe("Đường dẫn tương đối trong thư viện tài nguyên chung; list có thể bỏ trống để đọc thư mục gốc, thao tác khác bắt buộc."),
  query: z.string().max(500).optional().describe("Tùy chọn list: lọc tệp theo tên/đường dẫn trong path (đệ quy); bỏ trống chỉ liệt kê thư mục hiện tại."),
  cursor: z.string().max(1024).optional().describe("Tùy chọn list: dùng nextCursor trả về từ lần trước để tiếp tục, không tự tạo."),
  offset: z.number().int().min(1).optional().describe("Tùy chọn read: dòng đầu tiên của văn bản, bắt đầu từ 1."),
  limit: z.number().int().min(1).max(2000).optional().describe("list tối đa 50 mục/trang; read tối đa 2.000 dòng/lượt."),
  content: z.string().max(200000).optional().describe("Nội dung văn bản hoàn chỉnh cho create/update; chọn một trong content hoặc sourcePath; không dùng để ghi media Base64 giả."),
  sourcePath: z.string().min(1).max(4096).optional().describe("Tệp nguồn cho create/update phải thực sự tồn tại trong workspace, đường dẫn tương đối, tối đa 100 MB; chọn một trong sourcePath hoặc content."),
  revision: z.string().regex(/^[a-f\d]{64}$/i).optional().describe("Bắt buộc với update: revision SHA-256 từ lần read gần nhất, tránh ghi đè tệp đã đổi."),
  target: z.string().min(1).max(4096).optional().describe("Bắt buộc với move: đường dẫn đích trong thư viện chung; tùy chọn với import: đường dẫn đích trong workspace, bỏ trống để tạo tên tệp riêng."),
}).strict();

const actionFields: Record<z.infer<typeof requestSchema>["action"], readonly string[]> = {
  list: ["path", "query", "cursor", "limit"],
  read: ["path", "offset", "limit"],
  create: ["path", "content", "sourcePath"],
  update: ["path", "content", "sourcePath", "revision"],
  mkdir: ["path"],
  move: ["path", "target"],
  delete: ["path"],
  import: ["path", "target"],
};

export const assetRequestSchema = requestSchema.superRefine((request, context) => {
  for (const [field, value] of Object.entries(request)) {
    if (field !== "action" && value !== undefined && !actionFields[request.action].includes(field)) {
      context.addIssue({ code: "custom", path: [field], message: `${request.action} không chấp nhận ${field}` });
    }
  }
  if (request.action !== "list" && !request.path?.trim()) {
    context.addIssue({ code: "custom", path: ["path"], message: `${request.action} phải cung cấp đường dẫn tài nguyên trong path` });
  }
  if (request.action === "list" && request.limit !== undefined && request.limit > 50) {
    context.addIssue({ code: "custom", path: ["limit"], message: "list tối đa 50 mục mỗi trang" });
  }
  if ((request.action === "create" || request.action === "update") && (request.content !== undefined) === (request.sourcePath !== undefined)) {
    context.addIssue({ code: "custom", path: ["content"], message: "Phải cung cấp đúng một trong hai trường content hoặc sourcePath." });
  }
  if (request.action === "update" && !request.revision) {
    context.addIssue({ code: "custom", path: ["revision"], message: "Trước khi sửa phải read và cung cấp revision được trả về." });
  }
  if (request.action === "move" && !request.target?.trim()) {
    context.addIssue({ code: "custom", path: ["target"], message: "move phải có đường dẫn đích trong target" });
  }
});

export type AssetRequest = z.infer<typeof assetRequestSchema>;
