# Gemini Web To API — dịch vụ độc lập trên Mac Intel

Mã nguồn: `https://github.com/ntthanh2603/gemini-web-to-api`.
Revision đã ghim: `507f5aa244a421ec2cc10a664f4ec37eb108be54` (ngày 2026-11-17).
Giấy phép: MIT, bản quyền 2025 Nguyễn Tuấn Thành (xem `services/geminiWebToApi/upstream/LICENSE`).

Thư mục dịch vụ: `services/geminiWebToApi/`. Bản sao mã nguồn nằm trong `upstream/`; đây là Git checkout độc lập. Ba chỉnh sửa cục bộ:

- `internal/server/server.go`: chỉ lắng nghe `127.0.0.1` trên cổng do `PORT` chỉ định.
- `internal/commons/configs/configs.go`: cho phép bỏ cookie **chỉ khi** `GEMINI_LOCAL_HEALTH_ONLY=true`.
- `internal/modules/providers/provider_module.go`: không khởi tạo provider khi không có cookie, để kiểm tra HTTP nội bộ mà không gọi Google.

Máy hiện dùng macOS Intel x86_64, Go 1.25.1 được đặt trong `toolchain/go/` mà không cần `sudo`. Lệnh build từ thư mục gốc của dự án:

```bash
cd services/geminiWebToApi/upstream
GOTOOLCHAIN=local ../toolchain/go/bin/go build -o ../geminiWebServer ./cmd/server
```

Để tái tạo phiên bản đã ghim trên máy khác, clone upstream và checkout commit đã ghi ở trên, sau đó áp dụng ba thay đổi cục bộ được mô tả và biên dịch với Go 1.25.1 (hoặc phiên bản hỗ trợ `go.mod`). Các thư viện Go được khóa trong `go.mod` và `go.sum`.

Chạy kiểm tra HTTP **không có cookie** (chỉ kiểm tra máy chủ và các route):

```bash
cd services/geminiWebToApi/upstream
GEMINI_LOCAL_HEALTH_ONLY=true GEMINI_COOKIES= PORT=4981 ../geminiWebServer
```

Ở terminal khác:

```bash
curl --fail http://127.0.0.1:4981/health
```

Phản hồi mong đợi là `{"status":"ok","service":"gemini-web-to-api"}`. Chế độ này không kiểm tra được tạo nội dung bằng Gemini vì không có phiên đăng nhập; tắt nó khi chạy thật và cung cấp `GEMINI_COOKIES` theo hướng dẫn của upstream trong một biến môi trường riêng, không lưu vào Git. Nếu thiếu cookie ở chế độ thông thường, dịch vụ sẽ từ chối khởi động. Endpoint ứng dụng: `http://127.0.0.1:4981/openai/v1` và tài liệu: `http://127.0.0.1:4981/docs`.

Không sửa dịch vụ Muse2API đang chạy hoặc cấu hình production. Không cung cấp cookie, không gửi tác vụ có tính phí và không mở cổng cho máy khác trong mạng.
