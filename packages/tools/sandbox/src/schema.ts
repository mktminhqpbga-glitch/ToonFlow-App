import { z } from "zod";

const relativePathSchema = z.string().min(1).max(4096).regex(
  /^(?!\.{1,2}(?:\/|$))(?!.*\/\.{1,2}(?:\/|$))[^/\\:\u0000-\u001f\u007f]+(?:\/[^/\\:\u0000-\u001f\u007f]+)*$/,
  "Hãy dùng đường dẫn tương đối phân cách bằng /; không chứa thành phần rỗng, ., .., ký tự ổ đĩa hay ký tự điều khiển",
);

export const sandboxRequestSchema = z.object({
  command: z.string().min(1).max(20000).describe("Script Bash chạy trong /workspace; dùng js-exec cho JavaScript và python3 cho Python"),
  files: z.array(z.object({
    path: relativePathSchema.describe("Đường dẫn tệp tương đối từ /workspace ảo, ví dụ script.py"),
    content: z.string().max(1024 * 1024).describe("Nội dung văn bản đầy đủ của tệp"),
  }).strict()).max(32).optional().describe("Các tệp văn bản tạo trong sandbox lần này"),
  imports: z.array(z.object({
    path: z.string().min(1).max(4096).describe("Đường dẫn tương đối từ workspace hoặc đường dẫn tuyệt đối tệp kỹ năng toàn cục do skillOperator trả về"),
    target: relativePathSchema.describe("Đường dẫn tệp tương đối từ /workspace ảo sau khi import"),
  }).strict()).max(32).optional().describe("Tệp cần đọc trong lần chạy này; không tự nhập toàn bộ thư mục hay phụ thuộc script"),
  exports: z.array(z.object({
    path: relativePathSchema.describe("Tệp cần xuất, tương đối từ /workspace ảo"),
    target: relativePathSchema.describe("Vị trí lưu tương đối từ workspace hiện tại; tự tạo thư mục cha còn thiếu"),
    overwrite: z.boolean().optional().default(false).describe("Cho phép ghi đè tệp workspace đã có hay không; mặc định chỉ tạo mới"),
  }).strict()).max(32).optional().describe("Chỉ ghi các tệp này về workspace sau khi lệnh thành công; tệp không liệt kê sẽ mất khi sandbox kết thúc"),
  timeoutMs: z.number().int().min(1).max(60000).optional().default(30000).describe("Thời gian chờ chạy tính bằng mili giây, mặc định 30.000, tối đa 60.000"),
}).strict();

export type SandboxRequest = z.infer<typeof sandboxRequestSchema>;
