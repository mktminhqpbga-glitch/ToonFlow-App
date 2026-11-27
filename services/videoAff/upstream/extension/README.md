# Tiện ích Chrome VideoAFF

1. Mở **VideoAFF → Sản phẩm** trong MacFlow. Bấm **Tải tiện ích Chrome** và giải nén tệp `VideoAFF-Collector.zip`.
2. Trong Chrome, mở `chrome://extensions`, bật **Chế độ dành cho nhà phát triển** rồi bấm **Tải tiện ích đã giải nén**. Chọn thư mục `VideoAFF-Collector` chứa tệp `manifest.json`.
3. Mở trang sản phẩm TikTok Shop, sau đó mở tiện ích và bấm **Gửi sản phẩm này**. Sau khi gửi xong, bấm **Tạo video từ sản phẩm** để mở sản phẩm trong VideoAFF hoặc quay về trang **Sản phẩm**.
4. Để lấy ảnh tham khảo, duyệt từ khóa trong **Bộ nhớ AI → Ảnh bối cảnh**, đăng nhập Pinterest rồi bấm **Lấy ảnh Pinterest theo từ khóa đã duyệt** trong tiện ích.

Trong **Xuất dữ liệu**, bạn có thể tải danh sách sản phẩm dưới dạng Excel hoặc JSON. Mục **Thu thập nhiều sản phẩm** đọc trang chủ, các danh mục và trang từng sản phẩm. Bạn có thể chỉnh số thẻ được mở cùng lúc. Khi trang yêu cầu đăng nhập hoặc xác minh, tiện ích tạm dừng để bạn thao tác.

## Dành cho người phát triển

- Tệp ZIP tải từ MacFlow được cấu hình theo địa chỉ MacFlow hiện tại. Hãy tải lại ZIP nếu chuyển sang địa chỉ hoặc cổng khác.
- Chạy kiểm thử với `node --test extension/tests/background.test.cjs` từ thư mục mã nguồn VideoAFF.
