# Node văn bản

Viết, lưu và tạo nội dung với Markdown, phù hợp cho kịch bản, mô tả phân cảnh và phân tích tư liệu.

## Đầu vào và đầu ra

- Hỗ trợ văn bản, ảnh và video làm tham chiếu.
- Xuất toàn bộ chuỗi Markdown hiện tại để nối với các node phía sau hỗ trợ đầu vào văn bản.

## Cách sử dụng

1. Node hiển thị bản xem trước Markdown; bấm **Chỉnh sửa** để mở trình soạn thảo văn bản phong phú hoặc chuyển sang chỉnh Markdown nguồn.
2. Nếu cần AI tạo nội dung, chọn node, nhập yêu cầu và mô hình bên dưới. Nếu chưa có mô hình, thêm trong phần Cài đặt.
3. Có thể nối các node tham chiếu và mô tả cách sử dụng tư liệu đó trong prompt.
4. Bấm **Tạo**; văn bản xuất hiện dần và nội dung mới sẽ thay thế đầu ra hiện tại.
5. Sau khi tạo, bạn vẫn có thể chỉnh sửa bằng tay rồi nối đầu ra với node tiếp theo.

Nội dung chính tự lưu vào content.md của node; bản tải về có đuôi .md. Nếu nội dung trên đĩa xung đột, trước tiên hãy xem và sao chép bản hiện tại rồi chọn đọc lại tệp trên đĩa. Prompt AI phía dưới được chỉnh sửa độc lập.

Node tự xử lý chỉnh sửa và xem trước Markdown, tái sử dụng Tiptap, Marked và DOMPurify từ ứng dụng. Trình soạn thảo phong phú có thể chuẩn hóa cú pháp Markdown; dùng chế độ mã nguồn nếu cần giữ nguyên cách viết HTML gốc.

Khả năng hiểu ảnh/video tham chiếu phụ thuộc vào mô hình đã chọn.
