import { createToolConfig } from "@toonflow/tools-scaffold";

await createToolConfig({
  name: "workspace",
  displayName: "Tệp trong workspace",
  description: "Đọc, liệt kê, sửa tệp trong workspace hiện tại, tìm nội dung và tệp, tải ảnh từ web vào workspace.",
  prompt: `Đường dẫn được hiểu tương đối từ workspace hiện tại. Không được sửa tệp bên ngoài workspace; thư mục kỹ năng toàn cục chỉ cho phép đọc kỹ năng và tài liệu kèm theo.
grep tìm nội dung tệp, find tìm tệp; phạm vi chỉ trong workspace hiện tại, không tìm trong thư mục kỹ năng toàn cục.
Đọc nội dung liên quan trước khi sửa tệp có sẵn để không ghi đè thay đổi của người dùng.
Nếu có kỹ năng phù hợp, đọc SKILL.md của kỹ năng trước rồi đọc tài liệu liên quan khi cần; không tải toàn bộ kỹ năng và không suy đoán nội dung chỉ từ tên.`,
  author: "Toonflow",
  github: "https://github.com/HBAI-Ltd/Toonflow-app",
  configRules: [
    { type: "switch", field: "readOnly", title: "Chỉ đọc", value: false, info: "Khi bật, chỉ được đọc, liệt kê và tìm kiếm trong workspace." },
  ],
}, import.meta.url);
