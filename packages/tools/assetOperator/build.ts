import { createToolConfig } from "@toonflow/tools-scaffold";

await createToolConfig({
  name: "assetOperator",
  displayName: "Quản lý tài nguyên chung",
  description: "Tra cứu, đọc và quản lý thư viện tài nguyên chung; nhập tài nguyên vào workspace hoặc lưu kết quả tạo vào thư viện.",
  prompt: `Thư viện tài nguyên chung được quản lý bằng assetOperator, khác thư mục assets của workspace hiện tại.
Tra cứu và đọc tài nguyên liên quan trước khi sửa theo yêu cầu; giữ quyền đã cấp trong cuộc trò chuyện; chỉ hỏi khi xóa/ghi đè ngoài phạm vi cho phép.
Dùng sourcePath khi lưu kết quả tạo từ workspace vào thư viện; trước khi dùng tài nguyên chung trên Canvas hoặc làm tham chiếu, hãy import vào workspace và dùng đường dẫn thực được trả về.`,
  author: "Toonflow",
  github: "https://github.com/HBAI-Ltd/Toonflow-app",
  configRules: [
    { type: "switch", field: "readOnly", title: "Chỉ đọc", value: false, info: "Khi bật, không được sửa thư viện chung; vẫn có thể tìm, đọc và sao chép vào workspace." },
  ],
}, import.meta.url);
