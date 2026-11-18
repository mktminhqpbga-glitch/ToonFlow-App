import { createToolConfig } from "@toonflow/tools-scaffold";

await createToolConfig({
  name: "sandbox",
  displayName: "Sandbox mã",
  description: "Chạy Bash, JavaScript và Python trong filesystem bộ nhớ cô lập, có thể lưu tệp kết quả.",
  prompt: `Trước khi chạy mã kỹ năng, dùng skillOperator đọc hướng dẫn, rồi nhập script/tài liệu cần thiết bằng imports hoặc cung cấp script qua files.
Mỗi lần gọi sandbox dùng filesystem bộ nhớ mới tại /workspace. Chỉ import tệp được liệt kê; exports chỉ được ghi lại workspace sau khi chạy thành công và mặc định không ghi đè.
JavaScript chạy bằng js-exec trên QuickJS, không có API Node.js đầy đủ; Python chạy bằng python3 chỉ có thư viện tiêu chuẩn đi kèm, không hỗ trợ pip hay chương trình hệ thống. Sandbox không có mạng; không hứa chạy được mọi phụ thuộc của kỹ năng.`,
  author: "Toonflow",
  github: "https://github.com/HBAI-Ltd/Toonflow-app",
  configRules: [],
}, import.meta.url);
