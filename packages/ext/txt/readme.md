# Trình soạn thảo văn bản

Cho phép chỉnh sửa tệp văn bản thuần túy. Host tài liệu quản lý việc đọc tệp, hàng đợi lưu và lưu trước khi đóng. Component nhận nội dung qua `context.text` và gửi thay đổi bằng `context.updateText(text)`.

Tiện ích tự khai báo biểu tượng tệp, cỡ chữ và thiết lập tự xuống dòng; đọc cấu hình hiện tại qua `context.config`.

Chạy `bun run --cwd packages/ext/txt build` từ gốc repository để tạo `build/ext/ext-txt.umd.js`. Xem giao diện lập trình và ngữ cảnh tiện ích tại `packages/extScaffold/readme.md`.
