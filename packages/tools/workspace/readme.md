# Tệp trong workspace

Cho Agent đọc, liệt kê và chỉnh sửa tệp trong workspace của dự án hiện tại, đồng thời tải ảnh công khai từ web.

## Cách sử dụng

Mở dự án rồi nói tên tệp và yêu cầu, ví dụ: “Đọc tệp phân-cảnh.md và tóm tắt” hoặc “Lưu mô tả này thành nhân-vật.md”.
Đường dẫn được tính từ workspace hiện tại. Trước khi sửa tệp có sẵn, Agent phải đọc nội dung liên quan.

## Tính năng

- Liệt kê thư mục và đọc tệp.
- Tạo/ghi tệp mới hoặc chỉnh sửa nội dung tệp có sẵn.
- Tải ảnh HTTP(S) công khai vào `assets/chatImages/`, trả đường dẫn tương đối có thể xem trước. Hỗ trợ PNG, JPEG, WebP, GIF, AVIF, BMP, tối đa 20 MB/ảnh; không hỗ trợ SVG, ảnh cần đăng nhập hoặc địa chỉ mạng nội bộ.
- Đọc kỹ năng toàn cục và các tài liệu đi kèm khi được phép; thư mục kỹ năng toàn cục chỉ được đọc.

## Cấu hình

Trong **Cài đặt → Chợ tiện ích → Đã cài**, chọn **Tệp trong workspace** rồi bấm **Cấu hình**.
**Chế độ chỉ đọc** mặc định tắt; khi bật, công cụ chỉ đọc tệp và liệt kê thư mục, không còn ghi, sửa hoặc tải ảnh.
Chế độ này chỉ giới hạn công cụ hiện tại, không khóa khả năng sửa của công cụ Canvas khác.

Mọi thao tác sửa tệp đều giới hạn trong workspace; công cụ này không hỗ trợ xóa, đổi tên hay chạy lệnh terminal.
