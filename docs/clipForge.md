# Video sản phẩm với ClipForge

Trong MacFlow, mở dự án rồi chọn **Xưởng tạo video → Video sản phẩm · ClipForge**. MacFlow gửi ảnh sản phẩm và lời thoại đến dịch vụ ClipForge do bạn chọn. ClipForge dựng MP4, phụ đề và giọng đọc.

## Mở ClipForge

Chạy ClipForge trên máy có trình duyệt đang mở MacFlow. Bản ClipForge v0.11.1 đi kèm phông phụ đề rút gọn thiếu một số dấu tiếng Việt. Các lệnh Docker dưới đây dùng Noto Sans CJK bản đầy đủ để giữ dấu trong MP4 và mở ClipForge ở cổng 3457.

```sh
curl -fL https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf -o clipforge-subtitle.otf
docker run -d --name clipforge -p 127.0.0.1:3457:3000 \
  -v clipforge-data:/data \
  --mount "type=bind,source=$(pwd)/clipforge-subtitle.otf,target=/app/public/fonts/subtitle.otf,readonly" \
  ghcr.io/xixihhhh/clipforge
```

Mở `http://127.0.0.1:3457` để kiểm tra ClipForge. Nếu chạy từ mã nguồn, dùng phông tải ở trên thay cho `public/fonts/subtitle.otf` trong thư mục ClipForge. Nếu ClipForge dùng cổng khác, nhập địa chỉ tương ứng trong MacFlow. [Tài liệu ClipForge](https://github.com/xixihhhh/clipforge/tree/v0.11.1#快速开始) · [Giấy phép AGPL-3.0](https://github.com/xixihhhh/clipforge/blob/v0.11.1/LICENSE)

Với ClipForge trên máy khác, dùng HTTPS và cấu hình `CLIPFORGE_CORS_ORIGINS` trên máy chủ ClipForge với đúng origin của MacFlow, gồm giao thức, tên miền và cổng nếu có. Tích hợp gọi API trực tiếp từ trình duyệt. URL loopback trỏ tới máy đang mở trình duyệt.

## Dựng và đưa MP4 vào Canvas

1. Nhập địa chỉ ClipForge và bấm **Kiểm tra kết nối**.
2. Chọn một ảnh PNG, JPEG hoặc WebP tối đa 20 MiB. Nhập tên sản phẩm, điểm nổi bật nếu có và lời thoại. Xuống dòng ở từng đoạn muốn đưa lên phụ đề.
3. Chọn tỷ lệ 9:16, 16:9 hoặc 1:1, độ phân giải 720p hoặc 1080p. Chọn giọng Hoài My, Nam Minh hoặc **Chỉ phụ đề**. Hai giọng đọc dùng Edge TTS và cần kết nối mạng từ dịch vụ ClipForge. MacFlow hiển thị số đoạn bị thiếu giọng đọc khi ClipForge báo lỗi dựng âm thanh.
4. Bấm **Dựng video sản phẩm**. Dự án MacFlow lưu mã lượt dựng gần nhất để tiếp tục theo dõi sau khi tải lại. Có thể mở dự án tương ứng trong ClipForge để chỉnh sâu hơn.
5. Xem trước hoặc tải MP4. **Lưu vào dự án** lưu MP4 tối đa 100 MiB. **Đưa vào Canvas** dùng tệp đã lưu hoặc tự lưu trước khi tạo node Video. Với tệp lớn hơn, dùng **Tải MP4**.

Nếu mất kết nối ngay khi gửi lượt dựng, dùng **Kiểm tra tiến độ** để tra lại lượt đang theo dõi. **Ngừng theo dõi** cho phép bắt đầu lượt mới trong MacFlow. Lượt trước vẫn có thể tiếp tục chạy trong ClipForge.
