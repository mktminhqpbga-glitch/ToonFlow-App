# Tiện ích tài liệu Markdown

Hỗ trợ các tệp `.md` và `.markdown`; ID tiện ích là `ext-md`.

Gói này triển khai riêng trình soạn thảo Tiptap 3.31.3, mặc định ở chế độ văn bản có định dạng và có thể chuyển sang xem/chỉnh nguồn. Thanh công cụ, tìm kiếm, dán và kéo ảnh, liên kết tương đối tới ảnh và liên kết đều do gói quản lý. Tiptap, marked, DOMPurify được dùng chung từ host qua cơ chế external của scaffold; không đóng gói lặp lại hoặc dùng chung component trình soạn thảo.

Nội dung được liên kết với `context.text`; khi chỉnh sửa sẽ gọi đồng bộ `context.updateText`. Tự lưu, xung đột phiên bản, thử lại khi lỗi và lưu trước khi đóng tab vẫn do host tài liệu quản lý; gói này không giữ bản nháp độc lập hoặc trì hoãn gửi thay đổi. Thao tác tệp, mở liên kết, bộ nhớ tạm, tìm và chuyển tới vị trí cùng trạng thái hiển thị đều dùng các khả năng do host truyền vào.

Bản build chứa metadata tiện ích, trình soạn thảo riêng và CSS; host nạp phụ thuộc dùng chung khi cần trước lúc chạy tiện ích. Gạch chân, đánh dấu nổi bật, chỉ số trên/dưới, căn đoạn và bảng phức tạp trong tài liệu cũ vẫn được lưu dưới dạng HTML kết hợp; việc chỉ mở tệp hoặc đổi chế độ không tự viết lại nội dung nguồn.

Sau khi cài phụ thuộc tại gốc repository, chạy `bun run typecheck` trong `packages/ext/md`; chạy `bun run build` ở môi trường production để tạo `build/ext/ext-md.umd.js`. Build development hoặc watch sẽ đồng bộ thành phẩm tới `data/ext`.
