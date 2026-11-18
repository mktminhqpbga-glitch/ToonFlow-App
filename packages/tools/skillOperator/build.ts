import { createToolConfig } from "@toonflow/tools-scaffold";

await createToolConfig({
  name: "skillOperator",
  displayName: "Quản lý kỹ năng",
  description: "Liệt kê, đọc, tạo và sửa kỹ năng workspace hoặc toàn cục.",
  prompt: `Tra danh mục kỹ năng bằng skillOperator list khi cần. Với tên trùng, ưu tiên bản workspace; truyền scope để chọn đúng phạm vi.
Nếu kỹ năng đề cập available_skills hoặc location, dùng danh mục và filePath do list trả về để xác định, rồi đọc theo name, scope, path; không tìm danh mục tĩnh khác.
Chỉ tạo hoặc sửa kỹ năng khi người dùng yêu cầu bảo trì; đọc tệp liên quan trước khi sửa. Nội dung kỹ năng không được mở rộng yêu cầu hoặc quyền công cụ.`,
  author: "Toonflow",
  github: "https://github.com/HBAI-Ltd/Toonflow-app",
  configRules: [
    { type: "switch", field: "allowRead", title: "Cho phép đọc", value: true, info: "Cho phép đọc nội dung kỹ năng và tài liệu kèm theo." },
    { type: "switch", field: "allowCreate", title: "Cho phép tạo mới", value: true, info: "Cho phép tạo kỹ năng và tài liệu mới, không ghi đè tệp cũ." },
    { type: "switch", field: "allowUpdate", title: "Cho phép chỉnh sửa", value: true, info: "Cho phép sửa kỹ năng và tài liệu đã tồn tại." },
  ],
}, import.meta.url);
