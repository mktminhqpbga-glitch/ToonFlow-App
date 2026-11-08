# 📝 KHU VỰC 3 — LƯU Ý QUAN TRỌNG

**Tác dụng với người dùng:** xem các điều cần nhớ trước khi sửa, build hoặc phát hành ứng dụng.

**Tác dụng với AI tiếp nhận:** lưu quyết định, hạn chế và các ràng buộc không được bỏ qua. Mỗi lưu ý phải ghi nguồn, người ghi và phạm vi; lưu ý không phải là danh sách việc đã làm hoặc danh sách bug.

[← Về bảng điều hướng](./overview.md) · [Việc đã làm](./completedWork.md) · [Vấn đề tồn tại](./openIssues.md)

### NOTE-0001 — Mỗi AI phải lưu bằng chứng và tự ký tên

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** Mỗi thay đổi mã phải được ghi vào `completedWork.md`, kể cả sửa lỗi nhỏ; cập nhật vấn đề còn mở ở `openIssues.md` sau sửa; ghi phát hiện mới tại đây.
- **Lý do:** AI tiếp theo biết ai đã thay đổi, không nhầm người yêu cầu với người viết code và không suy đoán mức độ hoàn tất.
- **Phạm vi:** toàn repository.
- **Nguồn:** yêu cầu của chủ dự án trong cuộc trò chuyện hiện tại.

### NOTE-0002 — Giữ nguyên hướng dẫn kỹ thuật và giới hạn an toàn của repo

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** trước khi phát triển đọc `AGENTS.md` và các chỉ dẫn liên quan; file/thư mục mới dùng kiểu `lowerCamelCase`; không tự thêm test module trái quy định; không xóa dữ liệu OSS/database trực tuyến khi chưa được người dùng xác nhận từng thao tác.
- **Phạm vi:** phát triển.
- **Nguồn:** [AGENTS.md](../../AGENTS.md).

### NOTE-0003 — Phân biệt source code, build và tính năng đã chạy thật

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** tìm thấy component / event handler / API không đủ để kết luận đã chạy thành công. Ghi riêng: có trong mã, đã build, đã chạy chức năng UI, đã test yêu cầu AI.
- **Phạm vi:** kiểm thử và bàn giao.
- **Nguồn:** phân tích source trong repository.

### NOTE-0004 — macOS Intel cần chú ý phiên bản hệ điều hành

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Thông tin:** README/development guide của phiên bản hiện tại ghi desktop macOS yêu cầu **macOS 14 trở lên**, cả Intel và Apple Silicon.
- **Phạm vi:** build và tương thích.
- **Nguồn:** [README.md](../../README.md), [docs/development.md](../development.md).
- **Cần làm:** muốn hỗ trợ macOS cũ hơn cần kiểm tra lại SDK, runtime và thử trên máy thật; không khẳng định có thể chạy chỉ vì tạo được DMG.

### NOTE-0005 — Không coi công cụ browser là Chrome Extension / remote relay

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Thông tin:** `packages/tools/browser/` có công cụ thao tác Chrome/Edge bằng Agent trên máy. Chưa tìm thấy Chrome Extension chuyên dùng chuyển tác vụ tạo ảnh qua relay giữa máy trong lần kiểm tra.
- **Phạm vi:** thiết kế tích hợp AI.
- **Nguồn:** [browser tool](../../packages/tools/browser/readme.md).
- **Cần làm:** nếu cần extension/relay, phải thiết kế và xác minh riêng; không gắn nhãn “đã có” khi mới có browser automation.

### NOTE-0006 — Quyền truy cập server và API Key

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Thông tin:** README nêu cổng 3000 của bản server độc lập không có lớp đăng nhập nghiệp vụ riêng; phải có tường lửa/proxy xác thực nếu công khai. Dịch vụ tạo ảnh/video/audio cần mô hình/nhà cung cấp khả dụng và có thể phát sinh phí.
- **Phạm vi:** bảo mật, vận hành và kết nối AI.
- **Nguồn:** [README.md](../../README.md).
- **Quy tắc:** không bao giờ commit khóa hoặc token vào tài liệu công khai.

### NOTE-0007 — Thông tin tác giả gốc và giấy phép

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Thông tin:** source của repo hiện nhận diện upstream `HBAI-Ltd/Toonflow-app`, giấy phép MIT; khi sửa nhận diện hoặc phân phối lại vẫn phải giữ các thông báo giấy phép/bản quyền áp dụng.
- **Phạm vi:** phân phối / phát hành.
- **Nguồn:** [LICENSE](../../LICENSE), [package.json](../../package.json).

## Mẫu lưu ý mới

### NOTE-xxxx — Tên lưu ý

- **Ngày:** YYYY-MM-DD HH:mm (UTC+7)
- **Người ghi / AI:** [tên và model]
- **Thông tin hoặc quyết định:** [mô tả chính xác]
- **Lý do / ảnh hưởng:** [vì sao AI khác cần biết]
- **Phạm vi:** [đường dẫn, module hoặc toàn dự án]
- **Nguồn / bằng chứng:** [file/commit/yêu cầu trực tiếp]
- **Có cần xác minh lại không?:** Có/Không; [khi nào]
