# Node tạo video

Tạo video từ prompt và tư liệu tham chiếu. Hỗ trợ các chế độ mà mô hình hiện tại cung cấp: văn bản thành video, một ảnh, khung đầu/cuối hoặc tham chiếu kết hợp.

## Đầu vào và đầu ra

- Hỗ trợ văn bản, ảnh, video và âm thanh đầu vào; tổ hợp tham chiếu khả dụng phụ thuộc vào mô hình và chế độ tạo.
- Xuất video đã tạo; trình phát còn có thể trích khung hiện tại, đầu hoặc cuối thành node ảnh.

## Cách sử dụng

1. Chọn node và mô hình video. Nếu chưa có, thêm mô hình video trong Cài đặt.
2. Nhập yêu cầu về hành động, chuyển động camera và âm thanh; nối tư liệu tham chiếu, chỉnh thứ tự khi cần.
3. Mở cài đặt tạo để chọn chế độ, thời lượng, độ phân giải và tỉ lệ khung hình; nếu mô hình hỗ trợ có thể bật/tắt **Tạo âm thanh**.
4. Trong chế độ khung đầu/cuối, ảnh được phân bổ theo thứ tự tham chiếu. Với chế độ khung đầu tùy chọn, nếu chỉ có một ảnh thì ảnh đó được dùng làm khung cuối.
5. Bấm **Tạo video**; cần ngắt thì bấm **Dừng tạo**.
6. Khi hoàn tất, có thể phát, tua, chỉnh âm lượng, tải xuống hoặc xem toàn màn hình.

Để trích khung hình cần bật node ảnh. Tùy chọn thời lượng và độ phân giải thay đổi theo mô hình; nhà cung cấp quyết định tỉ lệ khung hình thực sự hỗ trợ.
