# Nhóm xây dựng phân cảnh

Ví dụ nhóm Agent chạy cục bộ: `director` điều phối, `writer` viết, `reviewer` rà soát. Các thành viên có thể phân công bằng khả năng giao việc nội bộ; tất cả chỉ dùng quyền đọc đã cấp. Ví dụ này không tạo media tiêu tốn tài nguyên tính toán và không tự động ghi vào workspace.

`team.json` khai báo thành viên, quan hệ giao việc và phạm vi quyền truy cập tài nguyên. Thư mục `members` chứa prompt, `skills/storyboard` chứa kỹ năng riêng của nhóm và `knowledge` chứa kiến thức riêng. **Riêng** nghĩa là không được đăng ký vào danh mục tài nguyên của nhóm khác, không có nghĩa nội dung được giấu khỏi người dùng trên máy.

Chạy `bun run build` để tạo `build/agents/storyboardTeam` và `storyboardTeam.agent.zip`. Trong môi trường development, lần build đầu có thể cài vào `data/agents/storyboardTeam`; nếu thư mục này đã tồn tại, mặc định giữ nguyên tất cả thay đổi của nó. Chỉ khi thật sự muốn thay thế toàn bộ bản cài phát triển bằng mã nguồn, chạy `NODE_ENV=dev bun run build --sync`; **lệnh này xóa các tệp trong bản cài không còn nằm trong mã nguồn**.

Truy cập A2A từ bên ngoài do host cung cấp địa chỉ, xác thực, mô hình và workspace. Bản đóng gói nhóm không chứa khóa và không tự lắng nghe cổng.
