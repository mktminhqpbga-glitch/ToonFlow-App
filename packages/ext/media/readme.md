# Xem trước âm thanh và video

Mở MP4, MP3, WAV, PCM và Opus trong trang tài liệu, không phân biệt chữ hoa/thường của phần mở rộng. Có nút phát, tạm dừng, thanh tiến độ và âm lượng; video hỗ trợ toàn màn hình. Khi tab bị ẩn, nội dung đang phát sẽ tạm dừng.

MP4, MP3, WAV và Opus trong container Ogg dùng khả năng giải mã gốc của ứng dụng khách. Codec không được hỗ trợ hoặc tệp hỏng sẽ hiển thị thông báo phát thất bại.

PCM thô mặc định dùng 24.000 Hz, một kênh, số nguyên 16-bit little-endian. Có thể chọn tần số lấy mẫu thực tế, một/hai kênh, số nguyên 8-bit không dấu hoặc 16/24/32-bit, số thực 32-bit, little-endian/big-endian trong phần xem trước. Dữ liệu đa kênh phải đan xen và gồm những khung mẫu hoàn chỉnh. Dữ liệu số nguyên có dấu và số thực được chuyển thành WAV 16-bit để phát; giá trị số thực không hữu hạn được coi là im lặng. Việc chuyển đổi chỉ diễn ra trong bộ nhớ, không sửa tệp gốc.

```sh
bun run --cwd packages/ext/media typecheck
bun run --cwd packages/ext/media build --mode development
```

Build development đồng bộ đến `data/ext/ext-media.umd.js`; build production xuất ra `build/ext/ext-media.umd.js` rồi được phát hành theo quy trình đóng gói tiện ích hiện có.
